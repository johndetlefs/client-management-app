import { add, minor } from "@/lib/finance/money";
import { calendarDate } from "@/lib/finance/period";
import type { CreditInput, CreditSource, CreditNote, CreditEntry, CreditRequest, CreditInvoice } from "./types";
const required = (s: string, label: string, max = 2000) => {
    if (typeof s !== "string" || !s.trim() || s.length > max)
        throw Error(`${label} is required`);
};
export function creditAmounts(input: CreditInput, source: CreditSource | undefined, issued: CreditNote[], today: string) {
    required(input.clientId, "Client");
    required(input.reason, "Reason");
    if (!/^[A-Z]{3}$/.test(input.currency))
        throw Error("Choose a valid currency");
    if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 100)
        throw Error("Add one to 100 credit lines");
    if (input.reference.length > 2000)
        throw Error("Reference is too long");
    if (input.saleDate) {
        calendarDate(input.saleDate);
        if (input.saleDate > today)
            throw Error("Supply date is in the future");
    }
    if (input.originalInvoiceId && !source)
        throw Error("Original invoice not found");
    if (source && (source.clientId !== input.clientId || source.currency !== input.currency))
        throw Error("Original invoice must have the same client and currency");
    const seen = new Set<number>();
    const lines = input.lines.map(line => {
        required(line.description, "Line description", 1000);
        const net = minor(line.netMinor), tax = minor(line.taxMinor);
        if (net < 0 || tax < 0 || add(net, tax) <= 0)
            throw Error("Credit amounts must be positive");
        if (!source)
            return { ...line, description: line.description.trim() };
        const index = line.originalLineIndex;
        if (index === undefined || !Number.isSafeInteger(index) || index < 0 || seen.has(index) || !source.lines[index])
            throw Error("Choose each original line once");
        seen.add(index);
        const original = source.lines[index];
        const previous = issued.filter(c => c.status === "issued" && c.original?.id === source.id).flatMap(c => c.input.lines.filter(l => l.originalLineIndex === index));
        const creditedNet = add(...previous.map(l => l.netMinor)), creditedTax = add(...previous.map(l => l.taxMinor));
        if (add(creditedNet, net) > original.netMinor)
            throw Error("Credit exceeds the remaining original line amount");
        const cumulativeTax = (n: number) => original.netMinor ? Number((BigInt(n) * BigInt(original.taxMinor) + BigInt(original.netMinor) / BigInt(2)) / BigInt(original.netMinor)) : 0;
        const sourceTax = original.netMinor ? add(cumulativeTax(add(creditedNet, net)), -cumulativeTax(creditedNet)) : tax;
        if (add(creditedTax, sourceTax) > original.taxMinor)
            throw Error("Credit exceeds the remaining original tax");
        return { ...line, description: line.description.trim(), taxMinor: sourceTax };
    });
    const netMinor = add(...lines.map(l => l.netMinor)), taxMinor = add(...lines.map(l => l.taxMinor)), totalMinor = add(netMinor, taxMinor);
    if (totalMinor <= 0)
        throw Error("Credit total must be positive");
    if (source) {
        const used = add(...issued.filter(c => c.status === "issued" && c.original?.id === source.id).map(c => c.issuedAmountMinor));
        if (add(used, totalMinor) > source.totalMinor)
            throw Error("Credit exceeds the original invoice amount remaining to credit");
    }
    else if (taxMinor && (!input.reference.trim() || !input.saleDate))
        throw Error("Enter the original sale reference and supply date for this GST adjustment");
    return { lines, netMinor, taxMinor, totalMinor };
}
export function creditState(note: Pick<CreditNote, "issuedAmountMinor" | "entries">, through?: string) {
    let appliedMinor = 0, refundedMinor = 0;
    const ids = new Set<string>(), reversed = new Set<string>();
    for (const entry of note.entries) {
        if (ids.has(entry.id))
            throw Error("Duplicate credit history entry");
        ids.add(entry.id);
        minor(entry.amountMinor);
        if (entry.amountMinor <= 0)
            throw Error("Invalid credit history amount");
        calendarDate(entry.date);
    }
    for (const entry of note.entries.filter(e => !through || e.date <= through)) {
        let kind = entry.kind, amount = entry.amountMinor;
        if (kind === "reversal") {
            const original = note.entries.find(e => e.id === entry.reverses);
            if (!original || original.kind === "reversal" || original.date > entry.date || original.amountMinor !== entry.amountMinor || reversed.has(original.id))
                throw Error("Invalid credit reversal");
            reversed.add(original.id);
            kind = original.kind;
            amount = -amount;
        }
        if (kind === "allocation")
            appliedMinor = add(appliedMinor, amount);
        else if (kind === "refund")
            refundedMinor = add(refundedMinor, amount);
    }
    const availableMinor = add(minor(note.issuedAmountMinor), -appliedMinor, -refundedMinor);
    if (appliedMinor < 0 || refundedMinor < 0 || availableMinor < 0)
        throw Error("Credit dispositions exceed issued credit");
    return { appliedMinor, refundedMinor, availableMinor };
}
export function creditEntry(note: CreditNote, request: CreditRequest, invoice: CreditInvoice | undefined, today: string, actor: string) {
    if (note.status !== "issued")
        throw Error("Issue the credit note before applying or refunding it");
    required(request.id, "Request identity", 100);
    required(request.reason, "Reason");
    if (request.reference.length > 2000)
        throw Error("Reference is too long");
    calendarDate(request.date);
    if (request.date > today || request.date < (note.issueDate || ""))
        throw Error("Disposition date must be between credit issue and today");
    const prior = note.entries.find(e => e.id === request.id);
    if (prior) {
        const original = prior.kind === "reversal" ? note.entries.find(e => e.id === prior.reverses) : undefined;
        const same = prior.kind === request.kind && prior.date === request.date && prior.reference === request.reference && prior.reason === request.reason && (prior.kind === "reversal" ? prior.reverses === request.entryId : prior.amountMinor === request.amountMinor && prior.invoiceId === (request.kind === "allocation" ? request.invoiceId : undefined));
        if (!same || prior.kind === "reversal" && !original)
            throw Error("Request identity was already used for different data");
        return { entry: prior, reused: true, invoiceDeltaMinor: 0, state: creditState(note) };
    }
    if (note.entries.length >= 100)
        throw Error("Credit history limit reached");
    const amount = minor(request.amountMinor);
    let invoiceDeltaMinor = 0;
    const entry: CreditEntry = { id: request.id, kind: request.kind, date: request.date, amountMinor: amount, reference: request.reference, reason: request.reason, actor, at: new Date().toISOString() };
    if (request.kind === "reversal") {
        const original = note.entries.find(e => e.id === request.entryId);
        if (!original || original.kind === "reversal" || note.entries.some(e => e.reverses === original.id))
            throw Error("This disposition cannot be reversed again");
        if (request.date < original.date)
            throw Error("Reversal date precedes the disposition");
        entry.amountMinor = original.amountMinor;
        entry.reverses = original.id;
        if (original.invoiceId) {
            entry.invoiceId = original.invoiceId;
            entry.invoiceNumber = original.invoiceNumber;
        }
        invoiceDeltaMinor = original.kind === "allocation" ? -original.amountMinor : 0;
    }
    else {
        if (amount <= 0 || amount > creditState(note).availableMinor)
            throw Error("Amount exceeds available credit");
        if (request.kind === "allocation") {
            if (!invoice || invoice.id !== request.invoiceId || invoice.clientId !== note.input.clientId || invoice.currency !== note.input.currency)
                throw Error("Choose an invoice for the same client and currency");
            if (["draft", "void"].includes(invoice.status) || invoice.creditedBy || !invoice.issueDate || invoice.issueDate > request.date || amount > invoice.balanceDueMinor)
                throw Error("Credit exceeds the invoice amount due or invoice is unavailable");
            entry.invoiceId = invoice.id;
            entry.invoiceNumber = invoice.number;
            invoiceDeltaMinor = amount;
        }
        else if (request.kind !== "refund")
            throw Error("Invalid credit action");
    }
    if (invoiceDeltaMinor && (!invoice || invoice.id !== entry.invoiceId || invoice.clientId !== note.input.clientId || invoice.currency !== note.input.currency || ["draft", "void"].includes(invoice.status) || invoice.creditedBy))
        throw Error("Linked invoice is unavailable for this credit action");
    if (invoice && add(invoice.creditAppliedMinor, invoiceDeltaMinor) < 0)
        throw Error("Invoice credit balance changed");
    const next = { ...note, entries: [...note.entries, entry] };
    for (const date of new Set(next.entries.map(e => e.date)))
        creditState(next, date);
    return { entry, reused: false, invoiceDeltaMinor, state: creditState(next) };
}
/** Validate each civil-date invoice position across all credit notes and actual dated cash.
 * Undated legacy paid amounts still constrain current due; they never acquire invented dates here.
 */
export function assertInvoiceCreditTimeline(invoice: {
    id: string;
    totalMinor: number;
}, notes: CreditNote[], receipts: import("@/lib/finance/types").Receipt[]) {
    const dates = new Map<string, {
        cash: number;
        credit: number;
    }>();
    const event = (date: string, cash: number, credit: number) => { calendarDate(date); const old = dates.get(date) || { cash: 0, credit: 0 }; dates.set(date, { cash: add(old.cash, cash), credit: add(old.credit, credit) }); };
    for (const receipt of receipts.filter(r => !r.reversedBy && !r.reversalOf))
        for (const a of receipt.allocations)
            if (a.invoiceId === invoice.id)
                event(receipt.date, minor(a.amountMinor), 0);
    for (const note of notes.filter(n => n.status === "issued"))
        for (const entry of note.entries) {
            const original = entry.kind === "reversal" ? note.entries.find(e => e.id === entry.reverses) : entry;
            if (original?.kind === "allocation" && original.invoiceId === invoice.id)
                event(entry.date, 0, entry.kind === "reversal" ? -minor(entry.amountMinor) : minor(entry.amountMinor));
        }
    let cash = 0, credit = 0;
    for (const [date, value] of [...dates].sort(([a], [b]) => a.localeCompare(b))) {
        cash = add(cash, value.cash);
        credit = add(credit, value.credit);
        if (cash < 0 || credit < 0 || add(cash, credit) > minor(invoice.totalMinor))
            throw Error(`Invoice would be overpaid on ${date}; choose a date with enough amount due`);
    }
}

export interface CreditLine {
    id?: string;
    description: string;
    netMinor: number;
    taxMinor: number;
    originalLineIndex?: number;
}
export interface CreditInput {
    id: string;
    clientId: string;
    currency: string;
    reason: string;
    reference: string;
    saleDate: string;
    originalInvoiceId?: string;
    lines: CreditLine[];
}
export interface CreditSource {
    id: string;
    version: string;
    clientId: string;
    currency: string;
    number: string;
    issueDate: string;
    totalMinor: number;
    lines: {
        description: string;
        netMinor: number;
        taxMinor: number;
    }[];
}
export interface CreditEntry {
    id: string;
    kind: "allocation" | "refund" | "reversal";
    date: string;
    amountMinor: number;
    invoiceId?: string;
    invoiceNumber?: string;
    reverses?: string;
    reference: string;
    reason: string;
    actor: string;
    at: string;
}
export interface CreditNote {
    id: string;
    revision: number;
    status: "draft" | "issued";
    input: CreditInput;
    original?: CreditSource;
    client: {
        name: string;
        email: string;
        abn: string;
        address: string[];
    };
    supplier: {
        businessName: string;
        abn: string;
        address: string;
        email: string;
        phone: string;
        invoiceFooter: string;
    };
    netMinor: number;
    taxMinor: number;
    totalMinor: number;
    issuedAmountMinor: number;
    appliedMinor: number;
    refundedMinor: number;
    availableMinor: number;
    entries: CreditEntry[];
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    issueDate?: string;
    number?: string;
    publicToken?: string;
}
export interface CreditInvoice {
    id: string;
    clientId: string;
    currency: string;
    number: string;
    totalMinor: number;
    amountPaidMinor: number;
    creditAppliedMinor: number;
    balanceDueMinor: number;
    status: string;
    issueDate: string;
    dueDate?: string;
    creditedBy?: string;
}
export interface CreditRequest {
    id: string;
    kind: "allocation" | "refund" | "reversal";
    amountMinor: number;
    invoiceId?: string;
    entryId?: string;
    date: string;
    reference: string;
    reason: string;
}

import test from "node:test";
import assert from "node:assert/strict";
import { WORKSPACE_NAV_ITEMS, getWorkspaceNavigation, legacyFinanceDestination } from "./routes";

test("five primary sections keep all sales documents as equal siblings", () => {
    assert.deepEqual(WORKSPACE_NAV_ITEMS.map(i => i.label), ["Clients", "Jobs", "Sales", "Bookkeeping", "Reports"]);
    const sales = WORKSPACE_NAV_ITEMS.find(i => i.id === "sales")!;
    assert.deepEqual(sales.children.map(i => i.label), ["Quotes", "Invoices", "Credit notes"]);
    for (const path of ["/workspace/quotes/q/edit", "/workspace/invoices/i", "/workspace/credits/c/print"]) assert.equal(getWorkspaceNavigation(path).section?.id, "sales");
});
test("accounting destinations and business utilities remain distinct", () => {
    assert.equal(getWorkspaceNavigation("/workspace/payments").section?.id, "bookkeeping");
    assert.equal(getWorkspaceNavigation("/workspace/expenses").section?.id, "bookkeeping");
    assert.equal(getWorkspaceNavigation("/workspace/bookkeeping/bas").item?.label, "BAS preparation");
    assert.equal(getWorkspaceNavigation("/workspace/settings/expenses").item?.label, "Expense settings");
    assert.equal(getWorkspaceNavigation("/workspace/settings").item?.label, "Business & invoices");
    assert.equal(getWorkspaceNavigation("/workspace/invoices-other").section, undefined);
});
test("legacy payment URL retains selected invoice and encoded query values", () => {
    assert.equal(legacyFinanceDestination({ invoice: "a/b", note: "one & two" }), "/workspace/payments?invoice=a%2Fb&note=one+%26+two");
    assert.equal(legacyFinanceDestination({ tab: "reports" }), "/workspace/bookkeeping/receivables");
});
test("route metadata identifies ordinary list create edit and print routes without raw IDs", () => {
    assert.equal(getWorkspaceNavigation("/workspace/credits").detail, undefined);
    assert.equal(getWorkspaceNavigation("/workspace/credits/new").detail, "New");
    assert.equal(getWorkspaceNavigation("/workspace/credits/note/edit").detail, "Edit");
    assert.equal(getWorkspaceNavigation("/workspace/invoices/id/print").detail, "Print preview");
});

test("Bookkeeping owns operational accounting while Reports is a direct analytical destination", () => {
 const book = WORKSPACE_NAV_ITEMS.find(i=>i.id==="bookkeeping")!;
 assert.deepEqual(book.children.map(i=>i.label),["Payments received","Expenses","Receivables & client credits","BAS preparation"]);
 for(const path of ["/workspace/bookkeeping/receivables","/workspace/bookkeeping/bas"]) assert.equal(getWorkspaceNavigation(path).section?.id,"bookkeeping");
 assert.equal(getWorkspaceNavigation("/workspace/reports/profit-loss").section?.id,"reports");
 assert.equal(WORKSPACE_NAV_ITEMS.find(i=>i.id==="reports")!.children.length,0);
});

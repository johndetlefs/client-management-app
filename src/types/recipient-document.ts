import type { Invoice, InvoiceLine } from "./invoice";
import type { Quote } from "./quote";

export type RecipientLine = Omit<InvoiceLine, "jobId" | "jobItemId">;
export type RecipientInvoice = Omit<Invoice, "clientId" | "lockedJobItemIds" | "publicToken" | "createdBy" | "issuedBy" | "lines"> & { lines: RecipientLine[] };
export type RecipientQuote = Omit<Quote, "clientId" | "jobId" | "selectedJobItemIds" | "publicToken" | "lines"> & { lines: RecipientLine[] };

import { Timestamp } from "firebase/firestore";

export type QuoteStatus = "draft" | "sent";

export interface Quote {
  id: string;
  tenantId: string;
  clientId: string;
  jobId: string;
  quoteNumber?: string;
  quoteDisplayNumber?: string;
  status: QuoteStatus;
  clientName: string;
  jobTitle?: string;
  totalMinor: number;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

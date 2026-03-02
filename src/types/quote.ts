import { Timestamp } from "firebase/firestore";
import { BillableUnit } from "./jobItem";

export type QuoteStatus = "draft" | "sent";

export interface QuoteLine {
  jobItemId: string;
  jobId: string;
  jobTitle: string;
  title: string;
  description?: string;
  unit: BillableUnit;
  quantity: number;
  unitPriceMinor: number;
  gstApplicable: boolean;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export interface Quote {
  id: string;
  tenantId: string;
  clientId: string;
  jobId: string;
  quoteNumber?: string;
  quoteDisplayNumber?: string;
  status: QuoteStatus;
  lines?: QuoteLine[];
  selectedJobItemIds?: string[];
  subtotalMinor?: number;
  taxMinor?: number;
  clientName: string;
  jobTitle?: string;
  notes?: string;
  totalMinor: number;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface QuoteCounter {
  year: number;
  lastNumber: number;
  updatedAt: Timestamp | Date;
}

export interface CreateQuoteFromJobData {
  jobId: string;
  jobItemIds: string[];
}

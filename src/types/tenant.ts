/**
 * Tax type options
 */
export type TaxType = "GST" | "VAT" | "Sales Tax" | "None";

/**
 * Tax settings
 */
export interface TaxSettings {
  taxType: TaxType;
  defaultRate: number; // e.g., 0.10 for 10%
}

/**
 * Bank account details for payment information
 */
export interface BankAccountDetails {
  accountName?: string;
  bsb?: string;
  accountNumber?: string;
}

/**
 * Business/invoice settings for a tenant
 */
export interface TenantSettings {
  // Business information
  businessName?: string;
  abn?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;

  // Payment details
  bankAccount?: BankAccountDetails;

  // Tax settings
  tax?: TaxSettings;

  // Invoice settings
  invoicePrefix?: string;
  invoiceTerms?: string;
  invoiceFooter?: string;

  // Metadata
  updatedAt?: Date;
  updatedBy?: string;
}

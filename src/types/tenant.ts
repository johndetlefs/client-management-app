/**
 * Tax type options
 */
export type TaxType = "GST" | "VAT" | "Sales Tax" | "None";

export type GstRegistrationStatus =
  | "unknown"
  | "not_registered"
  | "registered";

export interface GstRegistrationSettings {
  status: GstRegistrationStatus;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export type BasAccountingBasis = "cash" | "non_cash";
export type BasReportingCadence = "monthly" | "quarterly";

export interface BasPreparationSettings {
  accountingBasis: BasAccountingBasis;
  cadence: BasReportingCadence;
  reportingMethod: "simpler_bas";
}

/**
 * Tax settings
 */
export interface TaxSettings {
  taxType: TaxType;
  defaultRate: number; // e.g., 0.10 for 10%
  gstRegistration?: GstRegistrationSettings;
  basPreparation?: BasPreparationSettings;
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

  // Quote settings
  quotePrefix?: string;
  quoteTerms?: string;
  quoteFooter?: string;

  // Metadata
  updatedAt?: Date;
  updatedBy?: string;
}

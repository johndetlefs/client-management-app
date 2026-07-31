export interface DefaultExpenseCategory {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
}

const CATEGORY_NAMES = [
  ["accounting-legal", "Accounting and legal", "ACCOUNTING_LEGAL"],
  ["advertising-marketing", "Advertising and marketing", "ADVERTISING"],
  ["bank-payment-fees", "Bank and payment fees", "BANK_FEES"],
  ["software-online-services", "Computer, software and online services", "SOFTWARE"],
  ["contractors", "Contractors and outsourced services", "CONTRACTORS"],
  ["education-training", "Education and training", "EDUCATION"],
  ["equipment-assets", "Equipment and assets", "EQUIPMENT"],
  ["insurance", "Insurance", "INSURANCE"],
  ["meals-entertainment", "Meals and entertainment", "MEALS_ENTERTAINMENT"],
  ["motor-vehicle", "Motor vehicle", "MOTOR_VEHICLE"],
  ["office-supplies", "Office supplies", "OFFICE_SUPPLIES"],
  ["phone-internet", "Phone and internet", "PHONE_INTERNET"],
  [
    "memberships-subscriptions",
    "Professional memberships and subscriptions",
    "MEMBERSHIPS",
  ],
  ["rent-occupancy", "Rent and occupancy", "RENT_OCCUPANCY"],
  ["travel-transport", "Travel and transport", "TRAVEL"],
  ["accountant-review", "Other / accountant review", "REVIEW"],
] as const;

export const DEFAULT_EXPENSE_CATEGORIES: DefaultExpenseCategory[] =
  CATEGORY_NAMES.map(([id, name, code], index) => ({
    id,
    name,
    code,
    sortOrder: (index + 1) * 10,
  }));

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type {
  CollectionReference,
  DocumentReference,
} from "firebase-admin/firestore";
import type {
  Expense,
  ExpenseCandidate,
  ExpenseCategory,
  ExpenseExport,
  ExpenseImportBatch,
  ExpenseMerchantRule,
  ExpenseSourceFile,
} from "@/types/expense";

export type ExpenseTenantRole = "owner" | "staff";

export interface ExpenseTenantAccess {
  tenantId: string;
  userId: string;
  role: ExpenseTenantRole;
}

export class ExpenseAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpenseAccessError";
  }
}

export const EXPENSE_COLLECTION_NAMES = {
  importBatches: "expenseImportBatches",
  candidates: "expenseCandidates",
  expenses: "expenses",
  merchantRules: "expenseMerchantRules",
  categories: "expenseCategories",
  sourceFiles: "expenseSourceFiles",
  exports: "expenseExports",
} as const;

function assertFirestoreIdSegment(name: string, value: string): void {
  if (!value || value.includes("/")) {
    throw new Error(`${name} must be a non-empty Firestore ID segment`);
  }
}

export function tenantExpenseCollectionPaths(tenantId: string) {
  assertFirestoreIdSegment("tenantId", tenantId);

  const tenantPath = `tenants/${tenantId}`;

  return {
    importBatches: `${tenantPath}/${EXPENSE_COLLECTION_NAMES.importBatches}`,
    candidates: `${tenantPath}/${EXPENSE_COLLECTION_NAMES.candidates}`,
    expenses: `${tenantPath}/${EXPENSE_COLLECTION_NAMES.expenses}`,
    merchantRules: `${tenantPath}/${EXPENSE_COLLECTION_NAMES.merchantRules}`,
    categories: `${tenantPath}/${EXPENSE_COLLECTION_NAMES.categories}`,
    sourceFiles: `${tenantPath}/${EXPENSE_COLLECTION_NAMES.sourceFiles}`,
    exports: `${tenantPath}/${EXPENSE_COLLECTION_NAMES.exports}`,
  };
}

export function tenantExpenseCollectionRefs(tenantId: string) {
  const paths = tenantExpenseCollectionPaths(tenantId);

  return {
    importBatches: adminDb.collection(
      paths.importBatches,
    ) as CollectionReference<ExpenseImportBatch>,
    candidates: adminDb.collection(
      paths.candidates,
    ) as CollectionReference<ExpenseCandidate>,
    expenses: adminDb.collection(paths.expenses) as CollectionReference<Expense>,
    merchantRules: adminDb.collection(
      paths.merchantRules,
    ) as CollectionReference<ExpenseMerchantRule>,
    categories: adminDb.collection(
      paths.categories,
    ) as CollectionReference<ExpenseCategory>,
    sourceFiles: adminDb.collection(
      paths.sourceFiles,
    ) as CollectionReference<ExpenseSourceFile>,
    exports: adminDb.collection(paths.exports) as CollectionReference<ExpenseExport>,
  };
}

export function expenseImportBatchRef(
  tenantId: string,
  importBatchId: string,
): DocumentReference<ExpenseImportBatch> {
  assertFirestoreIdSegment("importBatchId", importBatchId);
  return tenantExpenseCollectionRefs(tenantId).importBatches.doc(importBatchId);
}

export function expenseCandidateRef(
  tenantId: string,
  candidateId: string,
): DocumentReference<ExpenseCandidate> {
  assertFirestoreIdSegment("candidateId", candidateId);
  return tenantExpenseCollectionRefs(tenantId).candidates.doc(candidateId);
}

export function expenseRef(
  tenantId: string,
  expenseId: string,
): DocumentReference<Expense> {
  assertFirestoreIdSegment("expenseId", expenseId);
  return tenantExpenseCollectionRefs(tenantId).expenses.doc(expenseId);
}

export function expenseMerchantRuleRef(
  tenantId: string,
  merchantRuleId: string,
): DocumentReference<ExpenseMerchantRule> {
  assertFirestoreIdSegment("merchantRuleId", merchantRuleId);
  return tenantExpenseCollectionRefs(tenantId).merchantRules.doc(merchantRuleId);
}

export function expenseCategoryRef(
  tenantId: string,
  categoryId: string,
): DocumentReference<ExpenseCategory> {
  assertFirestoreIdSegment("categoryId", categoryId);
  return tenantExpenseCollectionRefs(tenantId).categories.doc(categoryId);
}

export function expenseSourceFileRef(
  tenantId: string,
  sourceFileId: string,
): DocumentReference<ExpenseSourceFile> {
  assertFirestoreIdSegment("sourceFileId", sourceFileId);
  return tenantExpenseCollectionRefs(tenantId).sourceFiles.doc(sourceFileId);
}

export function expenseExportRef(
  tenantId: string,
  exportId: string,
): DocumentReference<ExpenseExport> {
  assertFirestoreIdSegment("exportId", exportId);
  return tenantExpenseCollectionRefs(tenantId).exports.doc(exportId);
}

export async function assertExpenseTenantAccess(
  tenantId: string,
  idToken: string,
): Promise<ExpenseTenantAccess> {
  try {
    assertFirestoreIdSegment("tenantId", tenantId);
  } catch (error) {
    throw new ExpenseAccessError(
      error instanceof Error ? error.message : "Invalid expense access input",
    );
  }

  if (!idToken) {
    throw new ExpenseAccessError("Authentication is required");
  }

  let userId: string;
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    userId = decodedToken.uid;
    assertFirestoreIdSegment("userId", userId);
  } catch {
    throw new ExpenseAccessError("Authentication is invalid or expired");
  }

  const tenantUserSnap = await adminDb
    .collection("tenants")
    .doc(tenantId)
    .collection("users")
    .doc(userId)
    .get();

  if (!tenantUserSnap.exists) {
    throw new ExpenseAccessError("User is not a member of this tenant");
  }

  const role = tenantUserSnap.get("role");
  if (role !== "owner" && role !== "staff") {
    throw new ExpenseAccessError("User does not have expense access");
  }

  return {
    tenantId,
    userId,
    role,
  };
}

import { BusinessError, assertResourceId } from "./errors";

type Kind = "string" | "boolean" | "id" | "ids" | "date" | "positive" | "minor" | "order" | "address" | "contacts" | readonly string[];
type Fields = Record<string, Kind>;
const CLIENT: Fields = {
  name: "string", email: "string", phone: "string", abn: "string", shortcode: "string",
  address: "address", contacts: "contacts", notes: "string", isActive: "boolean",
};
const JOB: Fields = {
  clientId: "id", title: "string", reference: "string", description: "string",
  status: ["active", "completed", "archived"], startDate: "date", endDate: "date", defaultDailyHours: "positive",
};
const ITEM: Fields = {
  jobId: "id", clientId: "id", title: "string", description: "string", sortOrder: "order",
  unit: ["hour", "half_day", "day", "unit", "expense"], quantity: "positive",
  unitPriceMinor: "minor", gstApplicable: "boolean", status: ["open"],
};
export const BUSINESS_INPUT_FIELDS = {
  client: CLIENT, job: JOB, item: ITEM,
  invoiceDraft: { clientId: "id", dueDate: "date", notes: "string", paymentInstructions: "string" },
  quoteCreate: { jobId: "id", jobItemIds: "ids" },
  quoteUpdate: { quoteDisplayNumber: "string", notes: "string" },
} satisfies Record<string, Fields>;

export function assertIdList(value: unknown, field: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length > 500 || new Set(value).size !== value.length) {
    throw new BusinessError("VALIDATION_ERROR", "Expected a bounded list of distinct resource identifiers", field);
  }
  for (const id of value) assertResourceId(id, field);
}

function assertFields(value: unknown, fields: Fields, path: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new BusinessError("VALIDATION_ERROR", "Expected an input object", path);
  }
  for (const [key, entry] of Object.entries(value)) {
    const field = `${path}.${key}`;
    if (!Object.hasOwn(fields, key)) throw new BusinessError("UNKNOWN_FIELD", "Unsupported input field", field);
    if (entry === undefined) continue; // Legacy forms omit optional fields as undefined.
    const kind = fields[key];
    if (Array.isArray(kind)) {
      if (!kind.includes(entry as string)) throw new BusinessError("VALIDATION_ERROR", "Unsupported field value", field);
    } else if (kind === "id") {
      assertResourceId(entry, field);
    } else if (kind === "ids") {
      assertIdList(entry, field);
    } else if (kind === "date") {
      if (entry !== null && (!(entry instanceof Date) || !Number.isFinite(entry.getTime()))) {
        throw new BusinessError("VALIDATION_ERROR", "Expected a valid date or explicit null", field);
      }
    } else if (kind === "address") {
      assertFields(entry, { street: "string", city: "string", state: "string", postcode: "string", country: "string" }, field);
    } else if (kind === "contacts") {
      if (!Array.isArray(entry) || entry.length > 100) throw new BusinessError("VALIDATION_ERROR", "Invalid contact list", field);
      entry.forEach((contact) => assertFields(contact, { name: "string", email: "string", phone: "string", position: "string" }, field));
    } else if (kind === "minor" || kind === "order" || kind === "positive") {
      if (typeof entry !== "number" || !Number.isFinite(entry) ||
          (kind !== "positive" && !Number.isSafeInteger(entry)) ||
          (kind === "minor" ? entry < 0 : entry <= 0)) {
        throw new BusinessError("VALIDATION_ERROR", "Invalid numeric input", field);
      }
    } else if (typeof entry !== kind || (kind === "string" && (entry as string).length > 10000)) {
      throw new BusinessError("VALIDATION_ERROR", "Invalid input field", field);
    }
  }
}

export function assertBusinessInput(kind: keyof typeof BUSINESS_INPUT_FIELDS, value: unknown): void {
  assertFields(value, BUSINESS_INPUT_FIELDS[kind], kind);
}

/** Remove omitted optional form fields without changing Date/Firestore sentinel instances. */
export function omitUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) return value.map(omitUndefinedFields) as T;
  if (value && typeof value === "object" &&
      (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, omitUndefinedFields(entry)])) as T;
  }
  return value;
}

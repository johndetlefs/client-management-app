export type BusinessErrorCode =
  | "AUTH_REQUIRED"
  | "ACCESS_DENIED"
  | "VALIDATION_ERROR"
  | "UNKNOWN_FIELD"
  | "UNSUPPORTED_CURRENCY"
  | "REVISION_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_CURSOR";

/** Safe to expose to an authenticated adapter; never contains tokens or provider errors. */
export class BusinessError extends Error {
  constructor(
    readonly code: BusinessErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "BusinessError";
  }
}

export function businessActionFailure(error: unknown, fallback: string) {
  if (error instanceof BusinessError) {
    return { success: false as const, error: error.message, code: error.code };
  }
  return { success: false as const, error: fallback };
}

export function assertResourceId(value: unknown, field: string): asserts value is string {
  if (
    typeof value !== "string" || value.length === 0 ||
    new TextEncoder().encode(value).length > 1500 ||
    /[\x00-\x1f/]/.test(value) || value === "." || value === ".." ||
    /^__.*__$/.test(value)
  ) {
    throw new BusinessError("VALIDATION_ERROR", "Invalid resource identifier", field);
  }
}

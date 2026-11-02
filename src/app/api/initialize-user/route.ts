import { NextRequest, NextResponse } from "next/server";
import { initializeVerifiedAccount } from "@/lib/business/initialize-account";
import { BusinessError } from "@/lib/business/errors";

export const runtime = "nodejs";

/** Only the verified new user may initialize their own business. */
export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Authentication is required", code: "AUTH_REQUIRED" }, { status: 401 });
  }
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).some((key) => !["userId", "email"].includes(key))) {
      throw new BusinessError("VALIDATION_ERROR", "Invalid signup input");
    }
    await initializeVerifiedAccount(body.userId, body.email, authorization.slice(7));
    return NextResponse.json({ success: true });
  } catch (error) {
    const known = error instanceof BusinessError;
    const status = known && error.code === "AUTH_REQUIRED" ? 401 : known && error.code === "ACCESS_DENIED" ? 403 : 400;
    return NextResponse.json({ error: known ? error.message : "Unable to initialize account", code: known ? error.code : "VALIDATION_ERROR" }, { status });
  }
}

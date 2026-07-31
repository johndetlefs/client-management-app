import { NextRequest, NextResponse } from "next/server";

import {
  assertExpenseTenantAccess,
  ExpenseAccessError,
} from "@/lib/expenses/firestore";
import { sanitizeExpenseFileName } from "@/lib/expenses/files";
import {
  deleteGeneratedExpenseExport,
  readGeneratedExpenseExport,
} from "@/lib/expenses/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = request.nextUrl.searchParams.get("tenantId") || "";
    const exportId = request.nextUrl.searchParams.get("exportId") || "";
    await assertExpenseTenantAccess(tenantId, bearerToken(request));
    const result = await readGeneratedExpenseExport({ tenantId, exportId });
    return new NextResponse(new Uint8Array(result.bytes), {
      status: 200,
      headers: {
        ...privateHeaders(),
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${headerFileName(
          result.fileName,
        )}"`,
      },
    });
  } catch (error) {
    return routeError(error, "Failed to download expense export");
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = request.nextUrl.searchParams.get("tenantId") || "";
    const exportId = request.nextUrl.searchParams.get("exportId") || "";
    const access = await assertExpenseTenantAccess(
      tenantId,
      bearerToken(request),
    );
    await deleteGeneratedExpenseExport({
      tenantId,
      userId: access.userId,
      exportId,
    });
    return NextResponse.json(
      { success: true },
      { status: 200, headers: privateHeaders() },
    );
  } catch (error) {
    return routeError(error, "Failed to delete expense export");
  }
}

function bearerToken(request: NextRequest): string {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

function headerFileName(value: string): string {
  return sanitizeExpenseFileName(value).replace(/["\\]/g, "_");
}

function privateHeaders(): Record<string, string> {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };
}

function routeError(error: unknown, fallback: string): NextResponse {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof ExpenseAccessError ? 403 : 400;
  return NextResponse.json(
    { error: message },
    { status, headers: privateHeaders() },
  );
}

import { NextRequest, NextResponse } from "next/server";

import {
  assertExpenseTenantAccess,
  ExpenseAccessError,
} from "@/lib/expenses/firestore";
import {
  normalizeSourceAccountKey,
  normalizeSourceAccountLabel,
  sanitizeExpenseFileName,
} from "@/lib/expenses/files";
import {
  deleteExpenseFile,
  readExpenseFile,
  storeExpenseFile,
} from "@/lib/expenses/storage";
import type { ExpenseStoredFilePurpose } from "@/types/expense";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = request.nextUrl.searchParams.get("tenantId") || "";
    const access = await assertExpenseTenantAccess(
      tenantId,
      bearerToken(request),
    );
    const formData = await request.formData();
    const file = formData.get("file");
    const purpose = formData.get("purpose");
    const linkedExpenseId = formData.get("linkedExpenseId");
    const rawSourceAccountKey = formData.get("sourceAccountKey");
    const rawSourceAccountLabel = formData.get("sourceAccountLabel");
    if (!(file instanceof File)) {
      throw new Error("Select a file to upload");
    }
    if (purpose !== "source" && purpose !== "receipt") {
      throw new Error("Expense file purpose is invalid");
    }
    const sourceAccountKey =
      purpose === "source" && typeof rawSourceAccountKey === "string"
        ? normalizeSourceAccountKey(rawSourceAccountKey)
        : undefined;
    const sourceAccountLabel =
      purpose === "source" && typeof rawSourceAccountLabel === "string"
        ? normalizeSourceAccountLabel(rawSourceAccountLabel)
        : undefined;
    if (purpose === "source" && (!sourceAccountKey || !sourceAccountLabel)) {
      throw new Error("Source account ID and label are required");
    }

    const result = await storeExpenseFile({
      tenantId,
      userId: access.userId,
      bytes: new Uint8Array(await file.arrayBuffer()),
      originalFileName: file.name,
      declaredMimeType: file.type,
      purpose: purpose as ExpenseStoredFilePurpose,
      sourceAccountKey,
      sourceAccountLabel,
      linkedExpenseId:
        typeof linkedExpenseId === "string" && linkedExpenseId
          ? linkedExpenseId
          : undefined,
    });
    return NextResponse.json(result, {
      status: 201,
      headers: privateHeaders(),
    });
  } catch (error) {
    return routeError(error, "Failed to upload expense file");
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = request.nextUrl.searchParams.get("tenantId") || "";
    const fileId = request.nextUrl.searchParams.get("fileId") || "";
    await assertExpenseTenantAccess(tenantId, bearerToken(request));
    const result = await readExpenseFile({ tenantId, fileId });
    return new NextResponse(new Uint8Array(result.bytes), {
      status: 200,
      headers: {
        ...privateHeaders(),
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${headerFileName(
          result.originalFileName,
        )}"`,
      },
    });
  } catch (error) {
    return routeError(error, "Failed to download expense file");
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = request.nextUrl.searchParams.get("tenantId") || "";
    const fileId = request.nextUrl.searchParams.get("fileId") || "";
    const access = await assertExpenseTenantAccess(
      tenantId,
      bearerToken(request),
    );
    await deleteExpenseFile({
      tenantId,
      userId: access.userId,
      fileId,
    });
    return NextResponse.json(
      { success: true },
      { status: 200, headers: privateHeaders() },
    );
  } catch (error) {
    return routeError(error, "Failed to delete expense file");
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

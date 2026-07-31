import { NextRequest, NextResponse } from "next/server";

import { generateTenantAccountantExport } from "@/lib/expenses/accountant-export-firestore";
import { assertExpenseTenantAccess } from "@/lib/expenses/firestore";
import { storeGeneratedExpenseExport } from "@/lib/expenses/storage";

export const runtime = "nodejs";

interface ExportRequestBody {
  tenantId?: string;
  periodStartDate?: string;
  periodEndDate?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authorization = request.headers.get("authorization") || "";
    const idToken = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : "";
    const body = (await request.json()) as ExportRequestBody;
    const tenantId = body.tenantId || "";
    const periodStartDate = body.periodStartDate || "";
    const periodEndDate = body.periodEndDate || "";

    const access = await assertExpenseTenantAccess(tenantId, idToken);
    const result = await generateTenantAccountantExport({
      tenantId,
      idToken,
      periodStartDate,
      periodEndDate,
    });
    const fileName = `accountant-export-${periodStartDate}-to-${periodEndDate}.xlsx`;
    const exportId = await storeGeneratedExpenseExport({
      tenantId,
      userId: access.userId,
      bytes: result.bytes,
      fileName,
      periodStartDate,
      periodEndDate,
      totals: {
        expenseCount: result.totals.expenseCount,
        grossAmountMinor: result.totals.grossExpensesMinor,
        claimableAmountMinor: result.totals.claimableExpensesMinor,
        gstAmountMinor: result.totals.claimableGstMinor,
        reviewNeededCount: result.totals.reviewNeededCount,
      },
    });

    return new NextResponse(new Uint8Array(result.bytes), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Expense-Export-Id": exportId,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate export";
    const status =
      message.includes("Authentication") ||
      message.includes("member") ||
      message.includes("expense access")
        ? 403
        : 400;
    return NextResponse.json(
      { error: message },
      {
        status,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  }
}

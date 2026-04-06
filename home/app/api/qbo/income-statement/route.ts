import { NextResponse } from "next/server";
import {
  fetchQBOReport,
  parseProfitAndLoss,
  monthRanges,
  QBOAuthError,
  type ProfitAndLossData,
} from "@/lib/quickbooks";
import { getQBOSession } from "../_auth";

export async function GET() {
  const session = await getQBOSession();
  if (!session) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  try {
    const ranges = monthRanges(3);

    // Fetch each month as a separate single-period report; this is more reliable
    // than summarize_column_by=Month which QBO sometimes ignores.
    const reports = await Promise.all(
      ranges.map((r) =>
        fetchQBOReport(session.realmId, session.accessToken, "ProfitAndLoss", {
          start_date: r.start_date,
          end_date: r.end_date,
        })
      )
    );

    // Parse each individually (single Money column = the month's total)
    const parsed = reports.map((r) => parseProfitAndLoss(r));

    // Merge: columns = month labels, amounts = [jan, feb, mar] per row
    const merged: ProfitAndLossData = {
      columns: ranges.map((r) => r.label),
      rows: parsed[0].rows.map((row) => ({
        ...row,
        amounts: parsed.map((p) => {
          const match = p.rows.find((r) => r.label === row.label);
          return match?.amounts[0] ?? null;
        }),
      })),
    };

    return NextResponse.json(merged);
  } catch (err) {
    if (err instanceof QBOAuthError) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
    console.error("Income statement fetch error:", err);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

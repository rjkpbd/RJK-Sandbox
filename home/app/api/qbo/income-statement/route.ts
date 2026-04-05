import { NextResponse } from "next/server";
import {
  fetchQBOReport,
  parseProfitAndLoss,
  lastNMonthsRange,
  QBOAuthError,
} from "@/lib/quickbooks";
import { getQBOSession } from "../_auth";

export async function GET() {
  const session = await getQBOSession();
  if (!session) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  try {
    const { start_date, end_date } = lastNMonthsRange(3);
    const raw = await fetchQBOReport(
      session.realmId,
      session.accessToken,
      "ProfitAndLoss",
      { start_date, end_date, summarize_column_by: "Month" }
    );
    return NextResponse.json(parseProfitAndLoss(raw));
  } catch (err) {
    if (err instanceof QBOAuthError) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
    console.error("Income statement fetch error:", err);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

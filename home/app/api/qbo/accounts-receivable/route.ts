import { NextResponse } from "next/server";
import {
  fetchQBOReport,
  parseAccountsReceivable,
  QBOAuthError,
} from "@/lib/quickbooks";
import { getQBOSession } from "../_auth";

export async function GET() {
  const session = await getQBOSession();
  if (!session) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  try {
    const raw = await fetchQBOReport(
      session.realmId,
      session.accessToken,
      "AgedReceivables"
    );
    return NextResponse.json(parseAccountsReceivable(raw));
  } catch (err) {
    if (err instanceof QBOAuthError) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
    console.error("Accounts receivable fetch error:", err);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

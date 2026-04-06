import { NextResponse, type NextRequest } from "next/server";
import { fetchQBOReport, lastNMonthsRange, QBOAuthError } from "@/lib/quickbooks";
import { getQBOSession } from "../_auth";
import { verifySessionToken } from "@/lib/session";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await verifySessionToken(token);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getQBOSession();
  if (!session) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const report = request.nextUrl.searchParams.get("report") ?? "ProfitAndLoss";

  try {
    const params: Record<string, string> = {};
    if (report === "AgedReceivables" || report === "AgedReceivableDetail") {
      // no extra params needed for AR reports
    } else if (report === "ProfitAndLoss") {
      const { start_date, end_date } = lastNMonthsRange(3);
      params.start_date = start_date;
      params.end_date = end_date;
    }
    const raw = await fetchQBOReport(session.realmId, session.accessToken, report, params);
    return NextResponse.json(raw);
  } catch (err) {
    if (err instanceof QBOAuthError) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

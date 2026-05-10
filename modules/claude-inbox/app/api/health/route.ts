import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "claude-inbox",
    timestamp: new Date().toISOString(),
  });
}

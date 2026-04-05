import { NextResponse } from "next/server";
import { cookieOptions } from "@/lib/session";

export async function POST() {
  const response = NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/login`
  );
  response.cookies.delete(cookieOptions.name);
  return response;
}

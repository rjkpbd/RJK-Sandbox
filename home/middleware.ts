import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPath =
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/auth/");

  const token = request.cookies.get("session")?.value;
  const user = token ? await verifySessionToken(token) : null;

  // Unauthenticated → login
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated + login page → appropriate dashboard
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = user.role === "admin" ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  // Admin-only routes
  if (user && pathname.startsWith("/admin") && user.role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // User-only routes — admins go to /admin
  if (user && pathname.startsWith("/dashboard") && user.role !== "user") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

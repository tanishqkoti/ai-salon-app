import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (!request.cookies.get("owner_session")) {
    const loginUrl = new URL("/owner/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/salon/dashboard/:path*",
    "/salon/bookings/:path*",
    "/salon/customers/:path*",
    "/salon/staff/:path*",
    "/salon/services/:path*",
    "/salon/loyalty/:path*",
    "/salon/analytics/:path*",
    "/salon/settings/:path*",
  ],
};
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8010";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const apiKey = process.env.BACKEND_API_KEY;

  if (!authorization || !apiKey) {
    return NextResponse.json({ detail: "Owner login is not configured." }, { status: 401 });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/owner/session`, {
      method: "POST",
      headers: { Authorization: authorization, "X-API-Key": apiKey },
      cache: "no-store",
    });
    const responseText = await response.text();
    let payload: unknown = null;

    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        payload = { detail: responseText };
      }
    }

    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }

    const result = NextResponse.json(payload);
    result.cookies.set("owner_session", authorization.replace(/^Bearer\s+/i, ""), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
    });
    return result;
  } catch {
    return NextResponse.json({ detail: "Unable to reach the owner login service." }, { status: 502 });
  }
}
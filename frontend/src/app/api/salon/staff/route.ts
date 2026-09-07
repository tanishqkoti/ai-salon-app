import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8010";

export async function POST(request: NextRequest) {
  const ownerToken = request.cookies.get("owner_session")?.value;
  const apiKey = process.env.BACKEND_API_KEY;

  if (!ownerToken) return NextResponse.json({ detail: "Owner login required." }, { status: 401 });
  if (!apiKey) return NextResponse.json({ detail: "Owner staff access is not configured on the server." }, { status: 503 });

  try {
    const activeOnly = request.nextUrl.searchParams.get("active_only") ?? "true";
    const response = await fetch(`${API_BASE_URL}/staff/?active_only=${encodeURIComponent(activeOnly)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        Authorization: `Bearer ${ownerToken}`,
      },
      body: await request.text(),
      cache: "no-store",
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ detail: "Unable to reach the staff service right now." }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  const ownerToken = request.cookies.get("owner_session")?.value;
  const apiKey = process.env.BACKEND_API_KEY;
  if (!ownerToken) return NextResponse.json({ detail: "Owner login required." }, { status: 401 });
  if (!apiKey) return NextResponse.json({ detail: "Owner staff access is not configured on the server." }, { status: 503 });
  try {
    const query = new URLSearchParams();
    for (const key of ["active_only", "service_id", "service_name", "exclude_staff_id"]) {
      const value = request.nextUrl.searchParams.get(key);
      if (value) query.set(key, value);
    }
    const response = await fetch(`${API_BASE_URL}/staff/?${query.toString()}`, {
      headers: { "X-API-Key": apiKey, Authorization: `Bearer ${ownerToken}` },
      cache: "no-store",
    });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" } });
  } catch {
    return NextResponse.json({ detail: "Unable to reach the staff service right now." }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest) {
  const ownerToken = request.cookies.get("owner_session")?.value;
  const apiKey = process.env.BACKEND_API_KEY;
  const staffId = request.nextUrl.searchParams.get("staff_id");
  if (!ownerToken) return NextResponse.json({ detail: "Owner login required." }, { status: 401 });
  if (!apiKey) return NextResponse.json({ detail: "Owner staff access is not configured on the server." }, { status: 503 });
  if (!staffId) return NextResponse.json({ detail: "staff_id is required." }, { status: 400 });
  try {
    const action = request.nextUrl.searchParams.get("action");
    if (action === "update") {
      const response = await fetch(`${API_BASE_URL}/staff/${encodeURIComponent(staffId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey, Authorization: `Bearer ${ownerToken}` },
        body: await request.text(),
        cache: "no-store",
      });
      return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" } });
    }
    if (action === "status") {
      const response = await fetch(`${API_BASE_URL}/staff/${encodeURIComponent(staffId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey, Authorization: `Bearer ${ownerToken}` },
        body: await request.text(),
        cache: "no-store",
      });
      return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" } });
    }
    const response = await fetch(`${API_BASE_URL}/staff/${encodeURIComponent(staffId)}/deactivate`, {
      method: "PATCH",
      headers: { "X-API-Key": apiKey, Authorization: `Bearer ${ownerToken}` },
      cache: "no-store",
    });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" } });
  } catch {
    return NextResponse.json({ detail: "Unable to reach the staff service right now." }, { status: 502 });
  }
}

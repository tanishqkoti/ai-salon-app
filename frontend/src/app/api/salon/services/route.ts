import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8010";

export async function POST(request: NextRequest) {
  const ownerToken = request.cookies.get("owner_session")?.value;
  const apiKey = process.env.BACKEND_API_KEY;

  if (!ownerToken) return NextResponse.json({ detail: "Owner login required." }, { status: 401 });
  if (!apiKey) return NextResponse.json({ detail: "Owner service access is not configured on the server." }, { status: 503 });

  try {
    const activeOnly = request.nextUrl.searchParams.get("active_only") ?? "true";
    const response = await fetch(`${API_BASE_URL}/services/?active_only=${encodeURIComponent(activeOnly)}`, {
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
    return NextResponse.json({ detail: "Unable to reach the service catalog right now." }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  const ownerToken = request.cookies.get("owner_session")?.value;
  const apiKey = process.env.BACKEND_API_KEY;
  if (!ownerToken) return NextResponse.json({ detail: "Owner login required." }, { status: 401 });
  if (!apiKey) return NextResponse.json({ detail: "Owner service access is not configured on the server." }, { status: 503 });
  try {
    const response = await fetch(`${API_BASE_URL}/services/`, {
      headers: { "X-API-Key": apiKey, Authorization: `Bearer ${ownerToken}` },
      cache: "no-store",
    });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" } });
  } catch {
    return NextResponse.json({ detail: "Unable to reach the service catalog right now." }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest) {
  const ownerToken = request.cookies.get("owner_session")?.value;
  const apiKey = process.env.BACKEND_API_KEY;
  const serviceId = request.nextUrl.searchParams.get("service_id");
  if (!ownerToken) return NextResponse.json({ detail: "Owner login required." }, { status: 401 });
  if (!apiKey) return NextResponse.json({ detail: "Owner service access is not configured on the server." }, { status: 503 });
  if (!serviceId) return NextResponse.json({ detail: "service_id is required." }, { status: 400 });
  try {
    const response = await fetch(`${API_BASE_URL}/services/${encodeURIComponent(serviceId)}/archive`, {
      method: "PATCH",
      headers: { "X-API-Key": apiKey, Authorization: `Bearer ${ownerToken}` },
      cache: "no-store",
    });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" } });
  } catch {
    return NextResponse.json({ detail: "Unable to reach the service catalog right now." }, { status: 502 });
  }
}

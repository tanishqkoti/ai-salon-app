import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8010";
const SALON_ID = "aura-studio";

type StatusUpdateBody = {
  status?: string;
};

async function forwardToBackend(
  path: string,
  options: RequestInit = {},
  ownerToken: string
): Promise<NextResponse> {
  const apiKey = process.env.BACKEND_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { detail: "Owner booking access is not configured on the server." },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        Authorization: `Bearer ${ownerToken}`,
        ...(options.headers ?? {}),
      },
      cache: "no-store",
    });
    const responseText = await response.text();

    return new NextResponse(responseText || null, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      { detail: "Unable to reach the booking service right now." },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  const ownerToken = request.cookies.get("owner_session")?.value;
  if (!ownerToken) {
    return NextResponse.json({ detail: "Owner login required." }, { status: 401 });
  }

  const salonId = request.nextUrl.searchParams.get("salon_id");

  if (salonId !== SALON_ID) {
    return NextResponse.json({ detail: "Salon not found." }, { status: 404 });
  }

  return forwardToBackend(`/bookings/?salon_id=${encodeURIComponent(SALON_ID)}`, {}, ownerToken);
}

export async function PATCH(request: NextRequest) {
  const ownerToken = request.cookies.get("owner_session")?.value;
  if (!ownerToken) {
    return NextResponse.json({ detail: "Owner login required." }, { status: 401 });
  }

  const bookingId = request.nextUrl.searchParams.get("booking_id");

  if (!bookingId) {
    return NextResponse.json(
      { detail: "booking_id is required." },
      { status: 400 }
    );
  }

  let body: StatusUpdateBody;
  try {
    body = (await request.json()) as StatusUpdateBody;
  } catch {
    return NextResponse.json({ detail: "Invalid request body." }, { status: 400 });
  }

  if (!body.status) {
    return NextResponse.json({ detail: "status is required." }, { status: 400 });
  }

  return forwardToBackend(`/bookings/${encodeURIComponent(bookingId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: body.status }),
  }, ownerToken);
}

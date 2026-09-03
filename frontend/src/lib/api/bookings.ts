export type BookingStatus =
  | "Pending"
  | "Confirmed"
  | "Completed"
  | "Cancelled"
  | "No-show";

export type CreateBookingPayload = {
  salon_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  notes?: string;
  service_id: string;
  service_name: string;
  stylist_id: string;
  stylist_name: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  amount: number;
};

export type BookingRecord = {
  id: string;
  salon_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  service_id: string;
  service_name: string;
  stylist_id: string;
  stylist_name: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  amount: number;
  status: BookingStatus;
  created_at?: string | null;
  updated_at?: string | null;
};

export type BookingApiResult = {
  id: string;
  booking: BookingRecord;
};

export type BookingListResponse = {
  count: number;
  bookings: BookingRecord[];
};

export type AvailabilityResponse = {
  salon_id: string;
  date: string;
  duration_minutes: number;
  available_slots: string[];
};

export type GetAvailabilityParams = {
  salon_id: string;
  date: string;
  duration_minutes: number;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8010";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const responseText = await response.text();
  let payload: unknown = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = responseText;
    }
  }

  if (!response.ok) {
    const responseBody =
      typeof payload === "object" && payload !== null
        ? payload as { detail?: unknown; message?: unknown }
        : null;
    const detail = responseBody?.detail ?? responseBody?.message;
    const message = detail
      ? typeof detail === "string"
        ? detail
        : JSON.stringify(detail)
      : "Could not create the booking.";
    const error = new Error(message) as Error & { detail?: unknown };
    error.detail = detail;
    throw error;
  }

  return payload as T;
}

export async function getSalonAvailability(
  params: GetAvailabilityParams
): Promise<AvailabilityResponse> {
  const query = new URLSearchParams({
    salon_id: params.salon_id,
    date: params.date,
    duration_minutes: String(params.duration_minutes),
  });

  return request<AvailabilityResponse>(`/bookings/availability?${query.toString()}`);
}

export async function getStylistAvailability(
  stylistId: string,
  params: GetAvailabilityParams
): Promise<AvailabilityResponse> {
  const query = new URLSearchParams({
    salon_id: params.salon_id,
    date: params.date,
    duration_minutes: String(params.duration_minutes),
  });

  return request<AvailabilityResponse>(
    `/bookings/stylists/${encodeURIComponent(stylistId)}/availability?${query.toString()}`
  );
}

export async function createBooking(
  payload: CreateBookingPayload
): Promise<BookingApiResult> {
  return request<BookingApiResult>("/bookings/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getBookingsBySalon(
  salonId: string
): Promise<BookingListResponse> {
  const query = new URLSearchParams({ salon_id: salonId });
  return request<BookingListResponse>(`/api/salon/bookings?${query.toString()}`);
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus
): Promise<BookingApiResult> {
  const query = new URLSearchParams({ booking_id: bookingId });
  return request<BookingApiResult>(`/api/salon/bookings?${query.toString()}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

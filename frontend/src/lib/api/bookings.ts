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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const responseText = await response.text();
  const payload = responseText ? JSON.parse(responseText) : null;

  if (!response.ok) {
    const detail = payload?.detail ?? payload?.message ?? "Request failed.";
    throw new Error(typeof detail === "string" ? detail : "Request failed.");
  }

  return payload as T;
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
  return request<BookingListResponse>(`/bookings/?${query.toString()}`);
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus
): Promise<BookingApiResult> {
  return request<BookingApiResult>(`/bookings/${bookingId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

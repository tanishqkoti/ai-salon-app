export type BookingStatus =
  | "Pending"
  | "Confirmed"
  | "Completed"
  | "Cancelled"
  | "No-show"
  | "Rescheduled";

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
  updated_by?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  previous_start_at?: string | null;
  previous_end_at?: string | null;
  rescheduled_at?: string | null;
  rescheduled_by?: string | null;
  reschedule_reason?: string | null;
  needs_service_mapping?: boolean;
  service_mapping_error?: string | null;
  previous_staff_id?: string | null;
  previous_staff_name?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  version?: number;
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

export type EligibleStylist = { id: string; name: string };

export type GetAvailabilityParams = {
  salon_id: string;
  date: string;
  duration_minutes: number;
  service_id?: string;
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
  if (params.service_id) query.set("service_id", params.service_id);

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
  if (params.service_id) query.set("service_id", params.service_id);

  return request<AvailabilityResponse>(
    `/bookings/stylists/${encodeURIComponent(stylistId)}/availability?${query.toString()}`
  );
}

export async function getEligibleStylists(salonId: string, serviceId: string): Promise<EligibleStylist[]> {
  const query = new URLSearchParams({ salon_id: salonId, service_id: serviceId });
  const response = await fetch(`${API_BASE_URL}/bookings/eligible-stylists?${query.toString()}`, { cache: "no-store" });
  const result = (await response.json()) as { detail?: string; stylists?: EligibleStylist[] };
  if (!response.ok || !result.stylists) throw new Error(result.detail || "Unable to load eligible stylists.");
  return result.stylists;
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
  return ownerBookingRequest<BookingListResponse>(`/api/salon/bookings?${query.toString()}`);
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus
): Promise<BookingApiResult> {
  const query = new URLSearchParams({ booking_id: bookingId });
  return ownerBookingRequest<BookingApiResult>(`/api/salon/bookings?${query.toString()}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

async function ownerBookingRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...options, cache: "no-store", headers: { "Content-Type": "application/json", ...(options.headers ?? {}) } });
  const responseText = await response.text();
  let payload: (T & { detail?: unknown }) | null = null;
  try {
    payload = responseText ? (JSON.parse(responseText) as T & { detail?: unknown }) : null;
  } catch {
    throw new Error("Could not cancel booking. The server returned an unexpected error.");
  }
  if (!response.ok) {
    const detail = payload?.detail;
    throw new Error(typeof detail === "string" ? detail : detail ? JSON.stringify(detail) : "Unable to update booking.");
  }
  if (!payload) {
    throw new Error("Could not cancel booking. The server returned an unexpected error.");
  }
  return payload;
}

export function getBookingDetails(bookingId: string): Promise<BookingApiResult> {
  return ownerBookingRequest<BookingApiResult>(`/api/salon/bookings?booking_id=${encodeURIComponent(bookingId)}`);
}

export function confirmBooking(bookingId: string): Promise<BookingApiResult> {
  return ownerBookingRequest<BookingApiResult>(`/api/salon/bookings?booking_id=${encodeURIComponent(bookingId)}&action=confirm`, { method: "POST" });
}

export function cancelBooking(bookingId: string, cancellationReason: string): Promise<BookingApiResult> {
  return ownerBookingRequest<BookingApiResult>(`/api/salon/bookings?booking_id=${encodeURIComponent(bookingId)}&action=cancel`, { method: "POST", body: JSON.stringify({ cancellation_reason: cancellationReason }) });
}

export function rescheduleBooking(bookingId: string, payload: { staff_id: string; appointment_date: string; appointment_time: string; reschedule_reason: string }): Promise<BookingApiResult> {
  return ownerBookingRequest<BookingApiResult>(`/api/salon/bookings?booking_id=${encodeURIComponent(bookingId)}&action=reschedule`, { method: "POST", body: JSON.stringify(payload) });
}

export function completeBooking(bookingId: string): Promise<BookingApiResult> {
  return ownerBookingRequest<BookingApiResult>(`/api/salon/bookings?booking_id=${encodeURIComponent(bookingId)}&action=complete`, { method: "POST" });
}

export function mapBookingService(bookingId: string, serviceId: string): Promise<BookingApiResult> {
  return ownerBookingRequest<BookingApiResult>(`/api/salon/bookings?booking_id=${encodeURIComponent(bookingId)}&action=service-mapping`, { method: "POST", body: JSON.stringify({ service_id: serviceId }) });
}

"use client";

import Link from "next/link";
import SalonDashboardHeader from "@/components/layout/SalonDashboardHeader";
import SalonSidebar from "@/components/layout/SalonSidebar";
import {
  cancelBooking,
  completeBooking,
  confirmBooking,
  getBookingDetails,
  getBookingsBySalon,
  mapBookingService,
  rescheduleBooking,
  type BookingRecord,
  type BookingStatus,
} from "@/lib/api/bookings";
import { getServices, type ServiceApiRecord } from "@/lib/api/services";
import { getEligibleStaff, type StaffApiRecord } from "@/lib/api/staff";
import { useEffect, useMemo, useState } from "react";

const SALON_ID = "aura-studio";

const statusStyles: Record<BookingStatus, string> = {
  Confirmed: "bg-blue-50 text-blue-700",
  Pending: "bg-amber-50 text-amber-700",
  Completed: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-rose-50 text-rose-700",
  "No-show": "bg-slate-100 text-slate-700",
  Rescheduled: "bg-violet-50 text-violet-700",
};

const statusOptions: BookingStatus[] = [
  "Pending",
  "Confirmed",
  "Completed",
  "Cancelled",
  "No-show",
];

export default function SalonBookingsPage() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingBookingId, setUpdatingBookingId] = useState("");
  const [dialogAction, setDialogAction] = useState<"confirm" | "cancel" | "reschedule" | "complete" | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);
  const [detailsBooking, setDetailsBooking] = useState<BookingRecord | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [actionReason, setActionReason] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleStaffId, setRescheduleStaffId] = useState("");
  const [eligibleStaff, setEligibleStaff] = useState<StaffApiRecord[]>([]);
  const [isStaffLoading, setIsStaffLoading] = useState(false);
  const [staffLookupError, setStaffLookupError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"All" | BookingStatus>("All");
  const [dateFilter, setDateFilter] = useState<"today" | "upcoming" | "all">("today");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [mappingBooking, setMappingBooking] = useState<BookingRecord | null>(null);
  const [mappingServices, setMappingServices] = useState<ServiceApiRecord[]>([]);
  const [mappingServiceId, setMappingServiceId] = useState("");
  const [isMappingLoading, setIsMappingLoading] = useState(false);
  const [mappingError, setMappingError] = useState("");

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    async function fetchBookings() {
      setIsLoading(true);
      setError("");

      try {
        const response = await getBookingsBySalon(SALON_ID);
        setBookings(response.bookings);
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load salon bookings right now."
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchBookings();
  }, [refreshKey]);

  const visibleBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const matchesStatus = statusFilter === "All" || booking.status === statusFilter;
      const matchesDate =
        dateFilter === "all" ||
        (dateFilter === "today" && booking.appointment_date === today) ||
        (dateFilter === "upcoming" && booking.appointment_date >= today);

      return matchesStatus && matchesDate;
    });
  }, [bookings, dateFilter, statusFilter, today]);

  const stats = useMemo(() => {
    return {
      Pending: bookings.filter((booking) => booking.status === "Pending").length,
      Confirmed: bookings.filter((booking) => booking.status === "Confirmed").length,
      Completed: bookings.filter((booking) => booking.status === "Completed").length,
      Cancelled: bookings.filter((booking) => booking.status === "Cancelled").length,
    };
  }, [bookings]);

  function openAction(booking: BookingRecord, action: "confirm" | "cancel" | "reschedule" | "complete") {
    setSelectedBooking(booking);
    setDialogAction(action);
    setActionReason("");
    setRescheduleDate(booking.appointment_date);
    setRescheduleTime(booking.appointment_time);
    setRescheduleStaffId("");
    setEligibleStaff([]);
    setStaffLookupError("");
    setError("");
  }

  async function openServiceMapping(booking: BookingRecord) {
    setMappingBooking(booking);
    setMappingServiceId("");
    setMappingError("");
    setIsMappingLoading(true);
    try {
      const response = await getServices();
      setMappingServices(response.services.filter((service) => service.is_active !== false));
    } catch (mappingLoadError) {
      setMappingError(mappingLoadError instanceof Error ? mappingLoadError.message : "Unable to load salon services.");
    } finally {
      setIsMappingLoading(false);
    }
  }

  async function saveServiceMapping(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mappingBooking || !mappingServiceId) return;
    const selectedService = mappingServices.find((service) => service.id === mappingServiceId);
    if (!selectedService || !window.confirm(`Map this booking to ${selectedService.name} (${selectedService.id})?`)) return;
    setIsMappingLoading(true);
    setMappingError("");
    try {
      const result = await mapBookingService(mappingBooking.id, mappingServiceId);
      setBookings((current) => current.map((booking) => booking.id === result.id ? result.booking : booking));
      setMappingBooking(null);
      setDetailsBooking(result.booking);
    } catch (mappingSaveError) {
      setMappingError(mappingSaveError instanceof Error ? mappingSaveError.message : "Unable to map booking service.");
    } finally {
      setIsMappingLoading(false);
    }
  }

  useEffect(() => {
    const bookingForStaff = selectedBooking;
    if (dialogAction !== "reschedule" || !bookingForStaff) return;
    const booking = bookingForStaff;

    let cancelled = false;
    async function loadEligibleStaff() {
      setIsStaffLoading(true);
      try {
        const response = await getEligibleStaff(booking.service_id, booking.stylist_id);
        if (cancelled) return;
        const replacementStaff = response.staff.filter((staff) => staff.id !== booking.stylist_id);
        if (process.env.NODE_ENV !== "production") console.info("booking_eligibility_lookup", { responseCount: response.count, normalizedOptionCount: replacementStaff.length });
        setEligibleStaff(replacementStaff);
        const currentStaff = response.staff.find((staff) => staff.id === booking.stylist_id);
        setRescheduleStaffId(currentStaff?.id ?? "");
      } catch (staffError) {
        if (!cancelled) setStaffLookupError(staffError instanceof Error ? staffError.message : "Unable to load eligible stylists.");
      } finally {
        if (!cancelled) setIsStaffLoading(false);
      }
    }

    void loadEligibleStaff();
    return () => { cancelled = true; };
  }, [dialogAction, selectedBooking]);

  async function openDetails(bookingId: string) {
    setIsDetailsLoading(true);
    setError("");
    try {
      const result = await getBookingDetails(bookingId);
      setDetailsBooking(result.booking);
    } catch (detailsError) {
      setError(detailsError instanceof Error ? detailsError.message : "Unable to load booking details.");
    } finally {
      setIsDetailsLoading(false);
    }
  }

  async function handleAction() {
    if (!selectedBooking || !dialogAction) return;
    setUpdatingBookingId(selectedBooking.id);
    setError("");
    setSuccessMessage("");

    try {
      if (dialogAction === "cancel" && !actionReason.trim()) throw new Error("Cancellation reason is required.");
      if (dialogAction === "reschedule" && (!actionReason.trim() || !rescheduleDate || !rescheduleTime || !rescheduleStaffId)) throw new Error("New stylist, date, time, and reschedule reason are required.");
      const result = dialogAction === "confirm"
        ? await confirmBooking(selectedBooking.id)
        : dialogAction === "complete"
          ? await completeBooking(selectedBooking.id)
          : dialogAction === "cancel"
            ? await cancelBooking(selectedBooking.id, actionReason)
            : await rescheduleBooking(selectedBooking.id, { staff_id: rescheduleStaffId, appointment_date: rescheduleDate, appointment_time: rescheduleTime, reschedule_reason: actionReason });
      setDialogAction(null);
      setSelectedBooking(null);
      setDetailsBooking(result.booking);
          setBookings((currentBookings) => currentBookings.map((booking) => booking.id === result.id ? result.booking : booking));
      setRefreshKey((current) => current + 1);
      setSuccessMessage(`Booking ${dialogAction === "reschedule" ? "rescheduled" : dialogAction + "ed"} successfully.`);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update booking status."
      );
    } finally {
      setUpdatingBookingId("");
    }
  }

  return (
    <>
      <SalonDashboardHeader />
      <main className="min-h-screen bg-[#fff9fb] text-[#2b1b25]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[230px_1fr] lg:px-8">
          <SalonSidebar />

          <section className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">Bookings</p>
                <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Appointment calendar</h1>
              </div>

              <Link href="/salon/dashboard" className="inline-flex rounded-full bg-[#d84b87] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#bf356e]">
                + New booking
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { name: "Pending", value: stats.Pending, tone: "text-amber-600" },
                { name: "Confirmed", value: stats.Confirmed, tone: "text-blue-600" },
                { name: "Completed", value: stats.Completed, tone: "text-emerald-600" },
                { name: "Cancelled", value: stats.Cancelled, tone: "text-rose-600" },
              ].map((card) => (
                <article key={card.name} className="rounded-2xl border border-[#f0dce5] bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-[#6d5863]">{card.name}</p>
                  <p className={`mt-3 text-3xl font-bold ${card.tone}`}>{card.value}</p>
                </article>
              ))}
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-[#f0dce5] bg-white p-5 shadow-sm sm:flex-row sm:items-end">
              <label className="grid gap-2 text-sm font-semibold">
                Status
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "All" | BookingStatus)}
                  className="rounded-xl border border-[#e9d4df] bg-white px-3 py-2 font-medium outline-none focus:border-[#d84b87]"
                >
                  <option value="All">All statuses</option>
                  {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold">
                Date
                <select
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value as "today" | "upcoming" | "all")}
                  className="rounded-xl border border-[#e9d4df] bg-white px-3 py-2 font-medium outline-none focus:border-[#d84b87]"
                >
                  <option value="today">Today</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="all">All bookings</option>
                </select>
              </label>
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {successMessage}
              </div>
            )}

            <section className="overflow-hidden rounded-3xl border border-[#f0dce5] bg-white shadow-sm">
              <div className="border-b border-[#f0dce5] px-6 py-5">
                <h2 className="text-xl font-bold">Recent bookings</h2>
              </div>

              {isLoading ? (
                <div className="px-6 py-10 text-sm text-[#6d5863]">Loading bookings...</div>
              ) : visibleBookings.length === 0 ? (
                <div className="px-6 py-10 text-sm text-[#6d5863]">
                  No bookings match the selected filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left">
                    <thead className="bg-[#fff9fb] text-sm text-[#6d5863]">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Date</th>
                        <th className="px-6 py-4 font-semibold">Time</th>
                        <th className="px-6 py-4 font-semibold">Customer</th>
                        <th className="px-6 py-4 font-semibold">Phone</th>
                        <th className="px-6 py-4 font-semibold">Service</th>
                        <th className="px-6 py-4 font-semibold">Stylist</th>
                        <th className="px-6 py-4 font-semibold">Amount</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                        <th className="px-6 py-4 font-semibold">Update</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleBookings.map((booking) => (
                        <tr key={booking.id} className="border-t border-[#f6e8ee] text-sm">
                          <td className="px-6 py-5 font-medium">{booking.appointment_date}</td>
                          <td className="px-6 py-5 font-medium">{booking.appointment_time}</td>
                          <td className="px-6 py-5">
                            <p className="font-semibold">{booking.customer_name}</p>
                            <p className="mt-1 text-[#6d5863]">#{booking.id.slice(0, 8)}</p>
                          </td>
                          <td className="px-6 py-5">{booking.customer_phone || "Not provided"}</td>
                          <td className="px-6 py-5"><span>{booking.service_name}</span>{booking.needs_service_mapping && <span className="ml-2 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Needs service mapping</span>}</td>
                          <td className="px-6 py-5">{booking.stylist_name}</td>
                          <td className="px-6 py-5 font-medium">₹{booking.amount.toLocaleString("en-IN")}</td>
                          <td className="px-6 py-5">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[booking.status]}`}>
                              {booking.status}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => openDetails(booking.id)} className="rounded-lg border border-[#e9d4df] px-3 py-2 text-xs font-semibold text-[#6d5863] transition hover:bg-[#fff0f6]">
                                {isDetailsLoading ? "Loading..." : "View details"}
                              </button>
                              {(booking.status === "Pending" || booking.status === "Rescheduled") && <button type="button" onClick={() => openAction(booking, "confirm")} disabled={updatingBookingId === booking.id} className="rounded-lg bg-[#d84b87] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Confirm</button>}
                              {(booking.status === "Pending" || booking.status === "Confirmed" || booking.status === "Rescheduled") && <>
                                <button type="button" onClick={() => openAction(booking, "cancel")} disabled={updatingBookingId === booking.id} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 disabled:opacity-60">Cancel</button>
                                <button type="button" onClick={() => openAction(booking, "reschedule")} disabled={updatingBookingId === booking.id || Boolean(booking.needs_service_mapping)} className="rounded-lg border border-[#e9d4df] px-3 py-2 text-xs font-semibold text-[#6d5863] disabled:opacity-60">Reschedule</button>
                              </>}
                              {booking.needs_service_mapping && <button type="button" onClick={() => void openServiceMapping(booking)} disabled={updatingBookingId === booking.id} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Map service</button>}
                              {(booking.status === "Confirmed") && <button type="button" onClick={() => openAction(booking, "complete")} disabled={updatingBookingId === booking.id} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Complete</button>}
                              {booking.status === "Completed" || booking.status === "Cancelled" || booking.status === "No-show" ? <span className="text-[#6d5863]">No action</span> : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </section>
        </div>
      </main>

      {detailsBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b1b25]/40 px-4 py-8">
          <section role="dialog" aria-modal="true" aria-labelledby="booking-details-title" className="w-full max-w-lg rounded-3xl border border-[#f0dce5] bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d84b87]">Booking details</p><h2 id="booking-details-title" className="mt-2 text-2xl font-bold">{detailsBooking.customer_name}</h2></div>
              <button type="button" onClick={() => setDetailsBooking(null)} className="rounded-full border border-[#e9d4df] px-3 py-2 text-sm font-semibold text-[#6d5863]">Close</button>
            </div>
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-[#6d5863]">Status</dt><dd className="font-semibold">{detailsBooking.status}</dd></div>
              <div><dt className="text-[#6d5863]">Customer phone</dt><dd className="font-semibold">{detailsBooking.customer_phone || "Not provided"}</dd></div>
              <div><dt className="text-[#6d5863]">Service</dt><dd className="font-semibold">{detailsBooking.service_name}</dd></div>
              <div><dt className="text-[#6d5863]">Stylist</dt><dd className="font-semibold">{detailsBooking.stylist_name}</dd></div>
              <div><dt className="text-[#6d5863]">Appointment</dt><dd className="font-semibold">{detailsBooking.appointment_date} at {detailsBooking.appointment_time}</dd></div>
              <div><dt className="text-[#6d5863]">Amount</dt><dd className="font-semibold">₹{detailsBooking.amount.toLocaleString("en-IN")}</dd></div>
            </dl>
            {detailsBooking.cancellation_reason && <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Cancellation reason: {detailsBooking.cancellation_reason}</p>}
            {detailsBooking.reschedule_reason && <p className="mt-5 rounded-xl bg-[#fff0f6] px-4 py-3 text-sm text-[#8a315a]">Reschedule reason: {detailsBooking.reschedule_reason}</p>}
          </section>
        </div>
      )}

      {mappingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b1b25]/40 px-4 py-8">
          <form onSubmit={(event) => void saveServiceMapping(event)} role="dialog" aria-modal="true" aria-labelledby="mapping-title" className="w-full max-w-lg rounded-3xl border border-[#f0dce5] bg-white p-6 shadow-xl">
            <h2 id="mapping-title" className="text-2xl font-bold">Map booking service</h2>
            <p className="mt-3 text-sm text-[#6d5863]">Choose the matching service for “{mappingBooking.service_name}”. This does not change the stored historical price.</p>
            <label className="mt-6 grid gap-2 text-sm font-semibold">Salon service<select required value={mappingServiceId} onChange={(event) => setMappingServiceId(event.target.value)} disabled={isMappingLoading} className="rounded-xl border border-[#e9d4df] bg-white px-4 py-3 font-normal"><option value="">Select a service</option>{mappingServices.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.id}</option>)}</select></label>
            {mappingError && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{mappingError}</p>}
            <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={isMappingLoading} onClick={() => setMappingBooking(null)} className="rounded-full border border-[#e9d4df] px-4 py-2 text-sm font-semibold text-[#6d5863]">Cancel</button><button type="submit" disabled={isMappingLoading || !mappingServiceId} className="rounded-full bg-[#d84b87] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isMappingLoading ? "Saving..." : "Confirm mapping"}</button></div>
          </form>
        </div>
      )}

      {selectedBooking && dialogAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b1b25]/40 px-4 py-8">
          <form onSubmit={(event) => { event.preventDefault(); void handleAction(); }} role="dialog" aria-modal="true" aria-labelledby="booking-action-title" className="w-full max-w-lg rounded-3xl border border-[#f0dce5] bg-white p-6 shadow-xl">
            <h2 id="booking-action-title" className="text-2xl font-bold capitalize">{dialogAction} booking</h2>
            <p className="mt-3 text-sm text-[#6d5863]">{selectedBooking.customer_name} · {selectedBooking.appointment_date} at {selectedBooking.appointment_time}</p>
            {dialogAction === "cancel" && <label className="mt-6 grid gap-2 text-sm font-semibold">Cancellation reason <span className="text-[#d84b87]">*</span><textarea required value={actionReason} onChange={(event) => setActionReason(event.target.value)} className="min-h-24 rounded-xl border border-[#e9d4df] px-4 py-3 font-normal outline-none focus:border-[#d84b87]" /></label>}
            {dialogAction === "reschedule" && <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold sm:col-span-2">New stylist <span className="text-[#d84b87]">*</span><select required value={rescheduleStaffId} onChange={(event) => setRescheduleStaffId(event.target.value)} disabled={isStaffLoading || Boolean(staffLookupError)} className="rounded-xl border border-[#e9d4df] bg-white px-4 py-3 font-normal outline-none focus:border-[#d84b87]"><option value="">{isStaffLoading ? "Loading eligible stylists..." : staffLookupError ? "Unable to load eligible stylists" : eligibleStaff.length ? "Select a stylist" : "No eligible stylists available"}</option>{eligibleStaff.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}</select></label>{staffLookupError && <p role="alert" className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{staffLookupError}</p>}<label className="grid gap-2 text-sm font-semibold">New date <span className="text-[#d84b87]">*</span><input required type="date" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} className="rounded-xl border border-[#e9d4df] px-4 py-3 font-normal outline-none focus:border-[#d84b87]" /></label><label className="grid gap-2 text-sm font-semibold">New time <span className="text-[#d84b87]">*</span><input required type="time" value={rescheduleTime} onChange={(event) => setRescheduleTime(event.target.value)} className="rounded-xl border border-[#e9d4df] px-4 py-3 font-normal outline-none focus:border-[#d84b87]" /></label><label className="grid gap-2 text-sm font-semibold sm:col-span-2">Reschedule reason <span className="text-[#d84b87]">*</span><textarea required value={actionReason} onChange={(event) => setActionReason(event.target.value)} className="min-h-24 rounded-xl border border-[#e9d4df] px-4 py-3 font-normal outline-none focus:border-[#d84b87]" /></label></div>}
            {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
            <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={Boolean(updatingBookingId)} onClick={() => { setDialogAction(null); setSelectedBooking(null); }} className="rounded-full border border-[#e9d4df] px-4 py-2 text-sm font-semibold text-[#6d5863] disabled:opacity-60">Cancel</button><button type="submit" disabled={Boolean(updatingBookingId)} className="rounded-full bg-[#d84b87] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{updatingBookingId ? (dialogAction === "cancel" || dialogAction === "reschedule" ? "Updating..." : "Updating...") : `Confirm ${dialogAction}`}</button></div>
          </form>
        </div>
      )}
    </>
  );
}

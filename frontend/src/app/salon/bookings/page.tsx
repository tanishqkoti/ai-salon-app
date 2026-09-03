"use client";

import Link from "next/link";
import SalonDashboardHeader from "@/components/layout/SalonDashboardHeader";
import SalonSidebar from "@/components/layout/SalonSidebar";
import {
  getBookingsBySalon,
  updateBookingStatus,
  type BookingRecord,
  type BookingStatus,
} from "@/lib/api/bookings";
import { useEffect, useMemo, useState } from "react";

const SALON_ID = "aura-studio";

const statusStyles: Record<BookingStatus, string> = {
  Confirmed: "bg-blue-50 text-blue-700",
  Pending: "bg-amber-50 text-amber-700",
  Completed: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-rose-50 text-rose-700",
  "No-show": "bg-slate-100 text-slate-700",
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
  const [statusFilter, setStatusFilter] = useState<"All" | BookingStatus>("All");
  const [dateFilter, setDateFilter] = useState<"today" | "upcoming" | "all">("today");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
  }, []);

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

  async function handleStatusChange(bookingId: string, nextStatus: BookingStatus) {
    setUpdatingBookingId(bookingId);
    setError("");
    setSuccessMessage("");

    try {
      const result = await updateBookingStatus(bookingId, nextStatus);
      setBookings((currentBookings) =>
        currentBookings.map((booking) =>
          booking.id === bookingId ? result.booking : booking
        )
      );
      setSuccessMessage(`Booking ${nextStatus.toLowerCase()} successfully.`);
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
                          <td className="px-6 py-5">{booking.service_name}</td>
                          <td className="px-6 py-5">{booking.stylist_name}</td>
                          <td className="px-6 py-5 font-medium">₹{booking.amount.toLocaleString("en-IN")}</td>
                          <td className="px-6 py-5">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[booking.status]}`}>
                              {booking.status}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            {booking.status === "Pending" ? (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(booking.id, "Confirmed")}
                                  disabled={updatingBookingId === booking.id}
                                  className="rounded-lg bg-[#d84b87] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#bf356e] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {updatingBookingId === booking.id ? "Updating..." : "Confirm"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(booking.id, "Cancelled")}
                                  disabled={updatingBookingId === booking.id}
                                  className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <span className="text-[#6d5863]">No action</span>
                            )}
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
    </>
  );
}

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
  Rescheduled: "bg-violet-50 text-violet-700",
};

export default function SalonDashboardPage() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

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
            : "Unable to load booking data for Aura Studio."
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchBookings();
  }, []);

  const stats = useMemo(() => {
    const activeBookings = bookings.filter(
      (booking) => booking.status !== "Cancelled"
    );

    const completedRevenue = bookings
      .filter((booking) => booking.status === "Completed")
      .reduce((total, booking) => total + booking.amount, 0);

    return {
      total: activeBookings.length,
      pending: bookings.filter((booking) => booking.status === "Pending").length,
      confirmed: bookings.filter((booking) => booking.status === "Confirmed")
        .length,
      revenue: completedRevenue,
    };
  }, [bookings]);

  async function updateBookingStatusForId(
    id: string,
    status: BookingStatus
  ) {
    setIsUpdating(true);
    setError("");

    try {
      const result = await updateBookingStatus(id, status);
      setBookings((currentBookings) =>
        currentBookings.map((booking) =>
          booking.id === id ? result.booking : booking
        )
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to change booking status."
      );
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <>
      <SalonDashboardHeader />
      <main className="min-h-screen bg-[#fff9fb] text-[#2b1b25]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[230px_1fr] lg:px-8">
          <SalonSidebar />

          <section>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d84b87]">
                  Today
                </p>

                <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
                  Good afternoon, Aura Studio.
                </h2>

                <p className="mt-3 text-[#6d5863]">
                  Here is a quick view of your salon&apos;s bookings today.
                </p>
              </div>

              <Link
                href="/book/aura-studio"
                className="rounded-full bg-[#d84b87] px-5 py-3 font-semibold text-white transition hover:bg-[#bf356e]"
              >
                + Create booking
              </Link>
            </div>

            {error && (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-[#f0dce5] bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-[#6d5863]">
                  Today&apos;s bookings
                </p>

                <p className="mt-3 text-3xl font-bold">{stats.total}</p>

                <p className="mt-2 text-sm text-[#6d5863]">
                  Active appointments
                </p>
              </article>

              <article className="rounded-2xl border border-[#f0dce5] bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-[#6d5863]">
                  Pending approval
                </p>

                <p className="mt-3 text-3xl font-bold text-amber-600">
                  {stats.pending}
                </p>

                <p className="mt-2 text-sm text-[#6d5863]">
                  Need your response
                </p>
              </article>

              <article className="rounded-2xl border border-[#f0dce5] bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-[#6d5863]">Confirmed</p>

                <p className="mt-3 text-3xl font-bold text-blue-600">
                  {stats.confirmed}
                </p>

                <p className="mt-2 text-sm text-[#6d5863]">
                  Ready for today
                </p>
              </article>

              <article className="rounded-2xl border border-[#f0dce5] bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-[#6d5863]">
                  Completed revenue
                </p>

                <p className="mt-3 text-3xl font-bold text-emerald-600">
                  ₹{stats.revenue.toLocaleString("en-IN")}
                </p>

                <p className="mt-2 text-sm text-[#6d5863]">
                  From completed services
                </p>
              </article>
            </div>

            <section className="mt-8 overflow-hidden rounded-3xl border border-[#f0dce5] bg-white shadow-sm">
              <div className="flex flex-col justify-between gap-3 border-b border-[#f0dce5] px-6 py-5 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-xl font-bold">Today&apos;s bookings</h3>

                  <p className="mt-1 text-sm text-[#6d5863]">
                    Approve, complete, or cancel appointments.
                  </p>
                </div>

                <span className="rounded-full bg-[#fff0f6] px-4 py-2 text-sm font-semibold text-[#d84b87]">
                  {bookings.length} total
                </span>
              </div>

              {isLoading ? (
                <div className="px-6 py-10 text-sm text-[#6d5863]">
                  Loading bookings...
                </div>
              ) : bookings.length === 0 ? (
                <div className="px-6 py-10 text-sm text-[#6d5863]">
                  No bookings are available for Aura Studio yet. New bookings will appear here once the customer flow is used.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left">
                    <thead className="bg-[#fff9fb] text-sm text-[#6d5863]">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Customer</th>
                        <th className="px-6 py-4 font-semibold">Service</th>
                        <th className="px-6 py-4 font-semibold">Stylist</th>
                        <th className="px-6 py-4 font-semibold">Time</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                        <th className="px-6 py-4 font-semibold">Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {bookings.map((booking) => (
                        <tr
                          key={booking.id}
                          className="border-t border-[#f6e8ee] text-sm"
                        >
                          <td className="px-6 py-5">
                            <p className="font-semibold">{booking.customer_name}</p>

                            <p className="mt-1 text-[#6d5863]">
                              ₹{booking.amount}
                            </p>
                          </td>

                          <td className="px-6 py-5">{booking.service_name}</td>

                          <td className="px-6 py-5">{booking.stylist_name}</td>

                          <td className="px-6 py-5 font-semibold">
                            {booking.appointment_date} · {booking.appointment_time}
                          </td>

                          <td className="px-6 py-5">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[booking.status]}`}
                            >
                              {booking.status}
                            </span>
                          </td>

                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              {booking.status === "Pending" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateBookingStatusForId(booking.id, "Confirmed")
                                  }
                                  disabled={isUpdating}
                                  className="rounded-lg bg-[#d84b87] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#bf356e] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Approve
                                </button>
                              )}

                              {booking.status === "Confirmed" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateBookingStatusForId(booking.id, "Completed")
                                  }
                                  disabled={isUpdating}
                                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Complete
                                </button>
                              )}

                              {booking.status !== "Completed" &&
                                booking.status !== "Cancelled" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateBookingStatusForId(
                                        booking.id,
                                        "Cancelled"
                                      )
                                    }
                                    disabled={isUpdating}
                                    className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Cancel
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              <article className="rounded-3xl border border-[#f0dce5] bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d84b87]">
                  Staff availability
                </p>

                <h3 className="mt-3 text-xl font-bold">Today&apos;s team</h3>

                <div className="mt-5 grid gap-4">
                  {[
                    ["Ananya", "Hair Stylist", "Available until 6:00 PM"],
                    ["Rahul", "Men’s Grooming", "Available until 7:00 PM"],
                    ["Priya", "Beauty Specialist", "Available until 5:30 PM"],
                  ].map(([name, role, availability]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-[#fff9fb] p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-pink-200 to-purple-200 font-bold text-[#7d3655]">
                          {name.charAt(0)}
                        </div>

                        <div>
                          <p className="font-semibold">{name}</p>

                          <p className="text-sm text-[#6d5863]">{role}</p>
                        </div>
                      </div>

                      <span className="text-right text-xs font-semibold text-emerald-600">
                        {availability}
                      </span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-3xl bg-[#2b1b25] p-6 text-white shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#f6a8c7]">
                  Coming next
                </p>

                <h3 className="mt-3 text-2xl font-bold">
                  Grow repeat customers.
                </h3>

                <p className="mt-4 leading-7 text-[#ecdde5]">
                  Loyalty points, VIP tracking, feedback, appointment reminders,
                  service history, and personalised offers will live here.
                </p>

                <Link
                  href="/salon/loyalty"
                  className="mt-6 inline-block rounded-full bg-[#d84b87] px-5 py-3 font-semibold text-white transition hover:bg-[#ef5d9d]"
                >
                  View growth tools
                </Link>
              </article>
            </section>
          </section>
        </div>
      </main>
    </>
  );
}
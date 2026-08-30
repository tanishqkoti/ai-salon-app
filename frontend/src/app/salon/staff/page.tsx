"use client";

import Link from "next/link";
import SalonDashboardHeader from "@/components/layout/SalonDashboardHeader";
import SalonSidebar from "@/components/layout/SalonSidebar";
import { useMemo, useState } from "react";

type StaffStatus = "Available" | "Busy" | "On Leave";

type StaffMember = {
  id: number;
  name: string;
  role: string;
  speciality: string;
  phone: string;
  rating: number;
  status: StaffStatus;
  todayHours: string;
  weeklyHours: string;
  services: string[];
  color: string;
};

const initialStaff: StaffMember[] = [
  {
    id: 1,
    name: "Ananya Sharma",
    role: "Senior Hair Stylist",
    speciality: "Haircuts, styling, hair spa & colour",
    phone: "+91 98765 43101",
    rating: 4.9,
    status: "Available",
    todayHours: "10:00 AM – 6:00 PM",
    weeklyHours: "Mon – Sat",
    services: ["Women’s Haircut", "Hair Spa", "Hair Colour", "Hair Styling"],
    color: "from-pink-300 to-purple-200",
  },
  {
    id: 2,
    name: "Rahul Patil",
    role: "Men’s Grooming Expert",
    speciality: "Men’s haircuts, beard styling & grooming",
    phone: "+91 98765 43102",
    rating: 4.8,
    status: "Busy",
    todayHours: "10:00 AM – 7:00 PM",
    weeklyHours: "Tue – Sun",
    services: ["Men’s Haircut", "Beard Grooming", "Hair Styling"],
    color: "from-blue-200 to-violet-200",
  },
  {
    id: 3,
    name: "Priya Kulkarni",
    role: "Beauty & Skin Specialist",
    speciality: "Facials, cleanup, skincare & bridal beauty",
    phone: "+91 98765 43103",
    rating: 4.9,
    status: "Available",
    todayHours: "11:00 AM – 5:30 PM",
    weeklyHours: "Mon – Sat",
    services: ["Facial", "Cleanup", "Bridal Beauty", "Skin Treatment"],
    color: "from-rose-200 to-amber-100",
  },
  {
    id: 4,
    name: "Sneha Desai",
    role: "Junior Beauty Therapist",
    speciality: "Spa, manicure, pedicure & basic beauty services",
    phone: "+91 98765 43104",
    rating: 4.6,
    status: "On Leave",
    todayHours: "Not available today",
    weeklyHours: "Wed – Sun",
    services: ["Spa", "Manicure", "Pedicure", "Cleanup"],
    color: "from-emerald-200 to-teal-100",
  },
];

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const statusStyles: Record<StaffStatus, string> = {
  Available: "bg-emerald-50 text-emerald-700",
  Busy: "bg-amber-50 text-amber-700",
  "On Leave": "bg-rose-50 text-rose-700",
};

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"All" | StaffStatus>(
    "All"
  );

  const filteredStaff = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return staff.filter((member) => {
      const matchesSearch =
        member.name.toLowerCase().includes(normalizedQuery) ||
        member.role.toLowerCase().includes(normalizedQuery) ||
        member.speciality.toLowerCase().includes(normalizedQuery);

      const matchesStatus =
        selectedStatus === "All" || member.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [staff, searchQuery, selectedStatus]);

  const stats = useMemo(() => {
    return {
      total: staff.length,
      available: staff.filter((member) => member.status === "Available").length,
      busy: staff.filter((member) => member.status === "Busy").length,
      leave: staff.filter((member) => member.status === "On Leave").length,
    };
  }, [staff]);

  function updateStaffStatus(id: number, status: StaffStatus) {
    setStaff((currentStaff) =>
      currentStaff.map((member) =>
        member.id === id ? { ...member, status } : member
      )
    );

    setSelectedStaff((currentSelectedStaff) =>
      currentSelectedStaff?.id === id
        ? { ...currentSelectedStaff, status }
        : currentSelectedStaff
    );
  }

  return (
    <>
      <SalonDashboardHeader />
      <main className="min-h-screen bg-[#fff9fb] px-4 py-8 text-[#2b1b25] sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[230px_1fr]">
          <SalonSidebar />

          <div className="space-y-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <Link
                  href="/salon/dashboard"
                  className="text-sm font-semibold text-[#d84b87] transition hover:text-[#bf356e]"
                >
                  ← Back to dashboard
                </Link>

                <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">
                  Staff management
                </p>

                <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
                  Staff &amp; availability
                </h1>

                <p className="mt-4 max-w-2xl text-lg leading-8 text-[#6d5863]">
                  Manage your stylists, their specialties, working hours,
                  services, and live availability.
                </p>
              </div>

              <button className="rounded-full bg-[#d84b87] px-5 py-3 font-semibold text-white transition hover:bg-[#bf356e]">
                + Add staff member
              </button>
            </div>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-[#f0dce5] bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-[#6d5863]">Total staff</p>
                <p className="mt-3 text-3xl font-bold">{stats.total}</p>
              </article>

              <article className="rounded-2xl border border-[#f0dce5] bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-[#6d5863]">Available now</p>
                <p className="mt-3 text-3xl font-bold text-emerald-600">
                  {stats.available}
                </p>
              </article>

              <article className="rounded-2xl border border-[#f0dce5] bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-[#6d5863]">Currently busy</p>
                <p className="mt-3 text-3xl font-bold text-amber-600">
                  {stats.busy}
                </p>
              </article>

              <article className="rounded-2xl border border-[#f0dce5] bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-[#6d5863]">On leave</p>
                <p className="mt-3 text-3xl font-bold text-rose-600">
                  {stats.leave}
                </p>
              </article>
            </section>

            <section className="rounded-3xl border border-[#f0dce5] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-bold">Your salon team</h2>
                  <p className="mt-1 text-sm text-[#6d5863]">
                    Select a staff member to see their profile and weekly
                    schedule.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search staff or speciality"
                    className="rounded-xl border border-[#e9d4df] px-4 py-3 text-sm outline-none transition focus:border-[#d84b87] focus:ring-2 focus:ring-[#f8c2d8]"
                  />

                  <select
                    value={selectedStatus}
                    onChange={(event) =>
                      setSelectedStatus(event.target.value as "All" | StaffStatus)
                    }
                    className="rounded-xl border border-[#e9d4df] bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-[#d84b87] focus:ring-2 focus:ring-[#f8c2d8]"
                  >
                    <option value="All">All availability</option>
                    <option value="Available">Available</option>
                    <option value="Busy">Busy</option>
                    <option value="On Leave">On leave</option>
                  </select>
                </div>
              </div>

              <div className="mt-7 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredStaff.map((member) => (
                  <article
                    key={member.id}
                    className="rounded-3xl border border-[#f0dce5] bg-[#fffdfd] p-6 transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div
                        className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${member.color} text-xl font-bold text-[#63364a]`}
                      >
                        {member.name.charAt(0)}
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[member.status]}`}
                      >
                        {member.status}
                      </span>
                    </div>

                    <h3 className="mt-5 text-xl font-bold">{member.name}</h3>

                    <p className="mt-1 font-medium text-[#d84b87]">{member.role}</p>

                    <p className="mt-3 text-sm leading-6 text-[#6d5863]">
                      {member.speciality}
                    </p>

                    <div className="mt-5 border-t border-[#f0dce5] pt-4 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-[#6d5863]">Today</span>
                        <span className="text-right font-semibold">
                          {member.todayHours}
                        </span>
                      </div>

                      <div className="mt-2 flex justify-between gap-3">
                        <span className="text-[#6d5863]">Rating</span>
                        <span className="font-semibold">★ {member.rating}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedStaff(member)}
                      className="mt-6 w-full rounded-full bg-[#2b1b25] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#4a303e]"
                    >
                      View profile &amp; schedule
                    </button>
                  </article>
                ))}
              </div>

              {filteredStaff.length === 0 && (
                <div className="py-12 text-center">
                  <p className="font-semibold">No staff members found.</p>
                  <p className="mt-2 text-sm text-[#6d5863]">
                    Try changing your search or availability filter.
                  </p>
                </div>
              )}
            </section>

            {selectedStaff && (
              <section className="rounded-3xl border border-[#f0dce5] bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${selectedStaff.color} text-xl font-bold text-[#63364a]`}
                    >
                      {selectedStaff.name.charAt(0)}
                    </div>

                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">
                        Staff profile
                      </p>
                      <h2 className="mt-2 text-3xl font-bold">
                        {selectedStaff.name}
                      </h2>
                      <p className="mt-1 text-[#6d5863]">
                        {selectedStaff.role} · {selectedStaff.phone}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedStaff(null)}
                    className="rounded-full border border-[#e9d4df] px-4 py-2 text-sm font-semibold text-[#6d5863] transition hover:bg-[#fff0f6]"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                  <article className="rounded-2xl bg-[#fff9fb] p-5">
                    <h3 className="text-lg font-bold">Services they can perform</h3>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedStaff.services.map((service) => (
                        <span
                          key={service}
                          className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-[#d84b87] shadow-sm"
                        >
                          {service}
                        </span>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-2xl bg-[#fff9fb] p-5">
                    <h3 className="text-lg font-bold">Work details</h3>

                    <div className="mt-4 grid gap-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-[#6d5863]">Today&apos;s hours</span>
                        <span className="text-right font-semibold">
                          {selectedStaff.todayHours}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-[#6d5863]">Weekly schedule</span>
                        <span className="text-right font-semibold">
                          {selectedStaff.weeklyHours}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-[#6d5863]">Customer rating</span>
                        <span className="text-right font-semibold">
                          ★ {selectedStaff.rating}
                        </span>
                      </div>
                    </div>
                  </article>
                </div>

                <section className="mt-8">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="text-xl font-bold">Weekly availability</h3>
                      <p className="mt-1 text-sm text-[#6d5863]">
                        This will later control which booking slots customers can
                        see.
                      </p>
                    </div>

                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[selectedStaff.status]}`}
                    >
                      Current: {selectedStaff.status}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                    {days.map((day) => {
                      const isSunday = day === "Sunday";
                      const isWorkingDay =
                        selectedStaff.weeklyHours.includes("Sun") || !isSunday;

                      return (
                        <div
                          key={day}
                          className={`rounded-2xl border p-4 ${
                            isWorkingDay
                              ? "border-[#f0dce5] bg-white"
                              : "border-[#f4e6ec] bg-[#fff9fb] text-[#9d8791]"
                          }`}
                        >
                          <p className="text-sm font-bold">{day.slice(0, 3)}</p>
                          <p className="mt-3 text-sm">
                            {isWorkingDay ? "10:00 AM" : "Off"}
                          </p>
                          <p className="mt-1 text-xs text-[#6d5863]">
                            {isWorkingDay ? "to 6:00 PM" : "Not working"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="mt-8 border-t border-[#f0dce5] pt-6">
                  <h3 className="text-xl font-bold">Update today&apos;s status</h3>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {(["Available", "Busy", "On Leave"] as StaffStatus[]).map(
                      (status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => updateStaffStatus(selectedStaff.id, status)}
                          className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                            selectedStaff.status === status
                              ? "bg-[#d84b87] text-white"
                              : "border border-[#e9d4df] bg-white text-[#6d5863] hover:bg-[#fff0f6]"
                          }`}
                        >
                          Mark as {status}
                        </button>
                      )
                    )}
                  </div>
                </section>
              </section>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
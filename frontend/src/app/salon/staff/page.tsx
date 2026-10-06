"use client";

import Link from "next/link";
import SalonDashboardHeader from "@/components/layout/SalonDashboardHeader";
import SalonSidebar from "@/components/layout/SalonSidebar";
import CreateStaffControl from "@/components/dashboard/CreateStaffControl";
import LifecycleAction from "@/components/dashboard/LifecycleAction";
import { deactivateStaff, getStaff, updateStaff, updateStaffStatus, type StaffApiRecord } from "@/lib/api/staff";
import { getServices, type ServiceApiRecord } from "@/lib/api/services";
import { useEffect, useMemo, useState } from "react";

type StaffStatus = "Available" | "Busy" | "On Leave";

type StaffMember = {
  id: number | string;
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
  isActive: boolean;
  isDemo: boolean;
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
    isActive: true,
    isDemo: true,
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
    isActive: true,
    isDemo: true,
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
    isActive: true,
    isDemo: true,
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
    isActive: true,
    isDemo: true,
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

function mapStaff(record: StaffApiRecord): StaffMember {
  return {
    id: record.id,
    name: record.name,
    role: record.role,
    speciality: record.speciality,
    phone: record.phone,
    rating: record.rating,
    status: record.status as StaffStatus,
    todayHours: record.today_hours,
    weeklyHours: record.weekly_hours,
    services: record.services,
    color: record.color,
    isActive: record.is_active !== false,
    isDemo: false,
  };
}

function mergeStaff(exampleStaff: StaffMember[], savedStaff: StaffApiRecord[]) {
  const merged = [...exampleStaff];
  const existingIds = new Set(merged.map((member) => String(member.id)));
  const existingPhones = new Set(merged.map((member) => member.phone.trim().toLowerCase()));

  for (const savedMember of savedStaff) {
    const mappedMember = mapStaff(savedMember);
    const hasStableId = Boolean(String(mappedMember.id).trim());
    const duplicate = hasStableId
      ? existingIds.has(String(mappedMember.id))
      : existingPhones.has(mappedMember.phone.trim().toLowerCase());
    if (!duplicate) {
      merged.push(mappedMember);
      existingIds.add(String(mappedMember.id));
      existingPhones.add(mappedMember.phone.trim().toLowerCase());
    }
  }

  return merged;
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"All" | StaffStatus>(
    "All"
  );
  const [loadError, setLoadError] = useState("");
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [services, setServices] = useState<ServiceApiRecord[]>([]);
  const [editForm, setEditForm] = useState({ name: "", role: "", speciality: "", phone: "", service_ids: [] as string[], today_hours: "", weekly_hours: "", is_active: true, bookable: true, status: "Available" });
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [savingStatusId, setSavingStatusId] = useState<number | string | null>(null);
  const [statusError, setStatusError] = useState("");
  const [statusSuccess, setStatusSuccess] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadStaff() {
      try {
        const response = await getStaff();
        if (isActive) {
          setStaff(mergeStaff(initialStaff, response.staff));
          setLoadError("");
        }
      } catch (error) {
        if (isActive) {
          setStaff(initialStaff);
          setLoadError(error instanceof Error ? error.message : "Unable to load saved staff members.");
        }
      }
    }

    loadStaff();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") loadStaff();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      isActive = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const filteredStaff = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const normalize = (value: string) => value.trim().toLowerCase();

    return staff.filter((member) => {
      const matchesSearch =
        normalize(member.name).includes(normalizedQuery) ||
        normalize(member.role).includes(normalizedQuery) ||
        normalize(member.speciality).includes(normalizedQuery);

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

  async function persistStaffStatus(member: StaffMember, status: StaffStatus) {
    if (member.isDemo) {
      setStatusError("Example staff status is not saved. Add this stylist as a real staff member to manage live availability.");
      setStatusSuccess("");
      return;
    }
    if (savingStatusId !== null) {
      return;
    }

    setSavingStatusId(member.id);
    setStatusError("");
    setStatusSuccess("");
    try {
      const result = await updateStaffStatus(String(member.id), status);
      const updated = mapStaff(result.staff);
      setStaff((current) => current.map((item) => (item.id === member.id ? updated : item)));
      setSelectedStaff((current) => (current?.id === member.id ? updated : current));
      setStatusSuccess(`Status updated to ${status}.`);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Unable to update staff status.");
    } finally {
      setSavingStatusId(null);
    }
  }

  function addCreatedStaff(record: StaffApiRecord) {
    setStaff((currentStaff) => mergeStaff(currentStaff, [record]));
  }

  async function openEditStaff(member: StaffMember) {
    setEditingStaff(member);
    setEditError("");
    setIsEditLoading(true);
    try {
      const response = await getServices();
      const activeServices = response.services.filter((service) => service.is_active !== false);
      const serviceIds = member.services.map((value) => activeServices.find((service) => service.id === value || service.name.toLowerCase() === value.toLowerCase())?.id).filter((value): value is string => Boolean(value));
      setServices(activeServices);
      setEditForm({ name: member.name, role: member.role, speciality: member.speciality, phone: member.phone, service_ids: serviceIds, today_hours: member.todayHours, weekly_hours: member.weeklyHours, is_active: member.isActive, bookable: true, status: member.status });
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Unable to load active services.");
    } finally {
      setIsEditLoading(false);
    }
  }

  async function saveStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingStaff || !editForm.name.trim() || !editForm.role.trim() || !editForm.phone.trim()) {
      setEditError("Name, role, and phone are required.");
      return;
    }
    setIsEditLoading(true);
    setEditError("");
    try {
      const result = await updateStaff(String(editingStaff.id), editForm);
      const updated = mapStaff(result.staff);
      setStaff((current) => current.map((member) => member.id === editingStaff.id ? updated : member));
      setSelectedStaff((current) => current?.id === editingStaff.id ? updated : current);
      setEditingStaff(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Unable to update staff member.");
    } finally {
      setIsEditLoading(false);
    }
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

              <div className="flex flex-col items-start gap-2 sm:items-end">
                <CreateStaffControl onCreated={addCreatedStaff} />
                <p className="max-w-xs text-sm text-[#6d5863] sm:text-right">
                  Create a real staff profile to manage saved details and availability.
                </p>
              </div>
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

            {loadError && (
              <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {loadError} Example staff members are still shown.
              </p>
            )}

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
                        {member.isActive ? member.status : "Inactive"}
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

                    <div className="mt-6 flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setSelectedStaff(member); setStatusError(""); setStatusSuccess(""); }}
                        className="flex-1 rounded-full bg-[#2b1b25] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#4a303e]"
                      >
                        View profile &amp; schedule
                      </button>
                      {!member.isDemo && member.isActive && (
                        <LifecycleAction
                          actionLabel="Deactivate staff"
                          onConfirm={async () => {
                            const result = await deactivateStaff(String(member.id));
                            setStaff((current) => current.map((item) => item.id === member.id ? mapStaff(result.staff) : item));
                          }}
                        />
                      )}
                    </div>
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
                    onClick={() => { setSelectedStaff(null); setStatusError(""); setStatusSuccess(""); }}
                    className="rounded-full border border-[#e9d4df] px-4 py-2 text-sm font-semibold text-[#6d5863] transition hover:bg-[#fff0f6]"
                  >
                    Close
                  </button>
                  {!selectedStaff.isDemo && <button type="button" onClick={() => void openEditStaff(selectedStaff)} className="rounded-full bg-[#d84b87] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#bf356e]">Edit staff</button>}
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
                  <div
                    role="note"
                    className={`mb-5 rounded-xl border px-4 py-3 ${
                      selectedStaff.isDemo
                        ? "border-amber-200 bg-amber-50 text-amber-900"
                        : "border-emerald-200 bg-emerald-50 text-emerald-900"
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      {selectedStaff.isDemo ? "Sample staff member" : "Real staff member"}
                    </p>
                    <p className="mt-1 text-sm leading-5">
                      {selectedStaff.isDemo
                        ? "Availability changes are for preview only and will not be saved. Add a real staff member to manage live availability."
                        : "Availability updates are saved and available for salon management."}
                    </p>
                  </div>

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
                    {((["Available", "Busy", "On Leave"] as StaffStatus[]).map(
                      (status) => {
                        const isSaving = savingStatusId === selectedStaff.id;
                        return (
                          <button
                            key={status}
                            type="button"
                            disabled={isSaving}
                            onClick={() => void persistStaffStatus(selectedStaff, status)}
                            className={`rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              selectedStaff.status === status
                                ? "bg-[#d84b87] text-white"
                                : "border border-[#e9d4df] bg-white text-[#6d5863] hover:bg-[#fff0f6]"
                            }`}
                          >
                            {isSaving ? "Saving..." : `Mark as ${status}`}
                          </button>
                        );
                      }
                    ))}
                  </div>

                  {statusError && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{statusError}</p>}
                  {statusSuccess && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{statusSuccess}</p>}

                  <div className="mt-4 flex flex-wrap gap-3">
                    {editingStaff && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b1b25]/40 px-4 py-8">
                        <form onSubmit={(event) => void saveStaff(event)} role="dialog" aria-modal="true" aria-labelledby="edit-staff-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[#f0dce5] bg-white p-6 shadow-xl">
                          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d84b87]">Staff management</p><h2 id="edit-staff-title" className="mt-2 text-2xl font-bold">Edit {editingStaff.name}</h2></div><button type="button" disabled={isEditLoading} onClick={() => setEditingStaff(null)} className="rounded-full border border-[#e9d4df] px-3 py-2 text-sm font-semibold text-[#6d5863] disabled:opacity-60">Cancel</button></div>
                          <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            {(["name", "role", "speciality", "phone", "weekly_hours", "today_hours"] as const).map((field) => <label key={field} className="grid gap-2 text-sm font-semibold">{field.replace("_", " ")} <span className="text-[#d84b87]">*</span><input required value={editForm[field]} onChange={(event) => setEditForm({ ...editForm, [field]: event.target.value })} className="rounded-xl border border-[#e9d4df] px-4 py-3 font-normal outline-none focus:border-[#d84b87]" /></label>)}
                            <fieldset className="sm:col-span-2"><legend className="text-sm font-semibold">Services they can perform <span className="text-[#d84b87]">*</span></legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{services.map((service) => <label key={service.id} className="flex items-center gap-3 rounded-xl border border-[#e9d4df] px-3 py-3 text-sm font-medium"><input type="checkbox" checked={editForm.service_ids.includes(service.id)} onChange={(event) => setEditForm({ ...editForm, service_ids: event.target.checked ? [...editForm.service_ids, service.id] : editForm.service_ids.filter((id) => id !== service.id) })} />{service.name}</label>)}</div>{!isEditLoading && !services.length && <p className="mt-2 text-sm text-rose-600">No active services are available.</p>}</fieldset>
                            <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={editForm.is_active} onChange={(event) => setEditForm({ ...editForm, is_active: event.target.checked })} />Active</label>
                            <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={editForm.bookable} onChange={(event) => setEditForm({ ...editForm, bookable: event.target.checked })} />Bookable</label>
                            <label className="grid gap-2 text-sm font-semibold">Today status<select value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })} className="rounded-xl border border-[#e9d4df] bg-white px-4 py-3 font-normal"><option>Available</option><option>Busy</option><option>On Leave</option></select></label>
                          </div>
                          {editError && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{editError}</p>}
                          <button type="submit" disabled={isEditLoading} className="mt-6 w-full rounded-full bg-[#d84b87] px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{isEditLoading ? "Saving..." : "Save staff changes"}</button>
                        </form>
                      </div>
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
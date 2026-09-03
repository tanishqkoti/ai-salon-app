"use client";

import Link from "next/link";
import CustomerNavbar from "@/components/layout/CustomerNavbar";
import Footer from "@/components/layout/Footer";
import {
  createBooking,
  getSalonAvailability,
  getStylistAvailability,
} from "@/lib/api/bookings";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const salonNames: Record<string, string> = {
  "aura-studio": "Aura Studio",
  "luxe-look": "Luxe Look Salon",
  "glow-spa": "Glow Spa & Wellness",
};

const services = [
  {
    id: "womens-haircut",
    name: "Women’s Haircut",
    duration: "45 min",
    price: 499,
    category: "Hair",
  },
  {
    id: "mens-haircut",
    name: "Men’s Haircut",
    duration: "30 min",
    price: 299,
    category: "Grooming",
  },
  {
    id: "hair-spa",
    name: "Hair Spa",
    duration: "60 min",
    price: 999,
    category: "Hair Care",
  },
  {
    id: "facial",
    name: "Facial",
    duration: "60 min",
    price: 1199,
    category: "Beauty",
  },
];

const stylists = [
  {
    id: "ananya",
    name: "Ananya",
    role: "Hair Stylist",
    speciality: "Haircuts, styling & colour",
    rating: "4.9",
  },
  {
    id: "rahul",
    name: "Rahul",
    role: "Men’s Grooming Expert",
    speciality: "Haircuts, beard & grooming",
    rating: "4.8",
  },
  {
    id: "priya",
    name: "Priya",
    role: "Beauty & Skin Specialist",
    speciality: "Facials, beauty & skincare",
    rating: "4.9",
  },
];

function getNextSevenDays() {
  const days: Array<{
    id: string;
    weekday: string;
    day: number;
    month: string;
  }> = [];

  for (let index = 0; index < 7; index += 1) {
    const date = new Date();
    date.setDate(date.getDate() + index);

    days.push({
      id: date.toISOString().split("T")[0],
      weekday: date.toLocaleDateString("en-IN", { weekday: "short" }),
      day: date.getDate(),
      month: date.toLocaleDateString("en-IN", { month: "short" }),
    });
  }

  return days;
}

export default function BookingPage() {
  const params = useParams<{ salonId: string }>();
  const salonId = params.salonId;
  const salonName = salonNames[salonId] ?? "Aura Studio";

  const availableDates = useMemo(() => getNextSevenDays(), []);
  const [step, setStep] = useState(1);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedStylistId, setSelectedStylistId] = useState("");
  const [selectedDateId, setSelectedDateId] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [createdBookingId, setCreatedBookingId] = useState("");
  const [anyStylistMode, setAnyStylistMode] = useState(false);
  const [availabilityRefresh, setAvailabilityRefresh] = useState(0);

  const selectedService = services.find(
    (service) => service.id === selectedServiceId
  );

  const selectedStylist = stylists.find(
    (stylist) => stylist.id === selectedStylistId
  );

  const selectedDate = availableDates.find(
    (date) => date.id === selectedDateId
  );

  const selectedDuration = selectedService
    ? Number.parseInt(selectedService.duration, 10)
    : 0;

  useEffect(() => {
    if (!selectedService || !selectedDate || !selectedDuration) {
      return;
    }

    const loadAvailability = async () => {
      setIsAvailabilityLoading(true);
      setAvailabilityError("");

      try {
        const data = anyStylistMode
          ? await getSalonAvailability({
              salon_id: salonId,
              date: selectedDate.id,
              duration_minutes: selectedDuration,
            })
          : selectedStylistId
            ? await getStylistAvailability(selectedStylistId, {
                salon_id: salonId,
                date: selectedDate.id,
                duration_minutes: selectedDuration,
              })
            : { salon_id: salonId, date: selectedDate.id, duration_minutes: selectedDuration, available_slots: [] };

        setAvailableSlots(data.available_slots ?? []);
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Unable to load available times.";
        setAvailabilityError(message);
        setAvailableSlots([]);
      } finally {
        setIsAvailabilityLoading(false);
      }
    };

    void loadAvailability();
  }, [anyStylistMode, availabilityRefresh, selectedDate, selectedDuration, selectedService, selectedStylistId, salonId]);

  const selectedEffectiveStylist = anyStylistMode ? stylists[0] : selectedStylist;

  const hasSelectedValidTime = Boolean(
    selectedDateId && selectedTime && availableSlots.includes(selectedTime)
  );

  const bookingReady = Boolean(
    selectedService &&
      selectedDateId &&
      selectedTime &&
      availableSlots.includes(selectedTime) &&
      customerName.trim() &&
      customerEmail.trim()
  );

  const canContinue =
    (step === 1 && selectedServiceId) ||
    (step === 2 && (selectedStylistId || anyStylistMode)) ||
    (step === 3 && hasSelectedValidTime) ||
    (step === 4 && bookingReady);

  function handleAnyStylistToggle() {
    setAnyStylistMode((current) => !current);
    setSelectedStylistId("");
    setSelectedTime("");
  }

  function handleTimeSelection(time: string) {
    if (!time || !selectedDateId || !selectedService) {
      return;
    }

    if (!availableSlots.includes(time)) {
      setSelectedTime("");
      return;
    }

    setSelectedTime(time);
  }

  function goNext() {
    if (canContinue && step < 4) {
      setStep((currentStep) => currentStep + 1);
    }
  }

  function goBack() {
    if (step > 1) {
      setStep((currentStep) => currentStep - 1);
    }
  }

  async function confirmBooking() {
    if (isSubmitting) {
      return;
    }

    if (!bookingReady || !selectedService || !selectedDate) {
      return;
    }

    const effectiveSelectedStylist = selectedEffectiveStylist;

    if (!effectiveSelectedStylist) {
      setSubmitError("Please choose a valid stylist before confirming the booking.");
      return;
    }

    setSubmitError("");

    try {
      setIsSubmitting(true);
      const result = await createBooking({
        salon_id: salonId,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim(),
        customer_phone: customerPhone.trim() || undefined,
        notes: customerNotes.trim() || undefined,
        service_id: selectedService.id,
        service_name: selectedService.name,
        stylist_id: effectiveSelectedStylist.id,
        stylist_name: effectiveSelectedStylist.name,
        appointment_date: selectedDate.id,
        appointment_time: selectedTime,
        duration_minutes: selectedDuration,
        amount: selectedService.price,
      });

      setCreatedBookingId(result.id);
      setIsConfirmed(true);
    } catch (error) {
      const errorText =
        error instanceof Error && error.message
          ? error.message
          : "Unable to create the booking right now. Please try again.";

      const detail =
        error && typeof error === "object" && "detail" in error
          ? (error as { detail?: { error?: string; message?: string } }).detail
          : null;

      if (detail?.error === "slot_unavailable") {
        setSubmitError("This slot was just booked. Please select another available time.");
        setSelectedTime("");
        setAvailabilityRefresh((current) => current + 1);
        setStep(3);
        return;
      }

      setSubmitError(errorText);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isConfirmed && selectedService && selectedDate) {
    return (
      <>
        <CustomerNavbar />
        <main className="min-h-screen bg-[#fff9fb] px-6 py-12 text-[#2b1b25] lg:px-8">
          <div className="mx-auto max-w-2xl rounded-3xl border border-[#f0dce5] bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e9faef] text-3xl">
              ✓
            </div>

            <p className="mt-7 text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">
              Booking confirmed
            </p>

            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
              You&apos;re booked, {customerName}.
            </h1>

            <p className="mt-4 leading-7 text-[#6d5863]">
              Your appointment request has been created. In the real version,
              this booking will be sent to the salon dashboard for confirmation.
            </p>

            <div className="mt-8 rounded-2xl bg-[#fff0f6] p-6 text-left">
              <p className="text-sm font-semibold text-[#d84b87]">
                Appointment details
              </p>

              <div className="mt-4 space-y-3 text-[#2b1b25]">
                <p>
                  <span className="font-semibold">Booking ID:</span> {createdBookingId}
                </p>
                <p>
                  <span className="font-semibold">Salon:</span> {salonName}
                </p>
                <p>
                  <span className="font-semibold">Service:</span>{" "}
                  {selectedService.name}
                </p>
                <p>
                  <span className="font-semibold">Stylist:</span>{" "}
                  {selectedEffectiveStylist?.name ?? "Any available stylist"}
                </p>
                <p>
                  <span className="font-semibold">Date:</span>{" "}
                  {selectedDate.weekday}, {selectedDate.day} {selectedDate.month}
                </p>
                <p>
                  <span className="font-semibold">Time:</span> {selectedTime}
                </p>
                <p>
                  <span className="font-semibold">Price:</span> ₹
                  {selectedService.price}
                </p>
              </div>
            </div>

            <Link
              href="/salons"
              className="mt-8 inline-block rounded-full bg-[#d84b87] px-7 py-4 font-semibold text-white transition hover:bg-[#bf356e]"
            >
              Explore more salons
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <CustomerNavbar />
      <main className="min-h-screen bg-[#fff9fb] px-6 py-10 text-[#2b1b25] lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Link
            href={`/salons/${salonId}`}
            className="text-sm font-semibold text-[#d84b87] transition hover:text-[#bf356e]"
          >
            ← Back to {salonName}
          </Link>

          <div className="mt-8 rounded-3xl border border-[#f0dce5] bg-white p-6 shadow-sm sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">
              Book appointment
            </p>

            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{salonName}</h1>

            <div className="mt-8 grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((item) => (
                <div key={item}>
                  <div
                    className={`h-2 rounded-full ${
                      item <= step ? "bg-[#d84b87]" : "bg-[#f3dce6]"
                    }`}
                  />
                  <p
                    className={`mt-2 text-center text-xs font-semibold ${
                      item === step ? "text-[#d84b87]" : "text-[#8d7782]"
                    }`}
                  >
                    {item === 1 && "Service"}
                    {item === 2 && "Stylist"}
                    {item === 3 && "Time"}
                    {item === 4 && "Details"}
                  </p>
                </div>
              ))}
            </div>

            {step === 1 && (
              <section className="mt-10">
                <h2 className="text-2xl font-bold">Choose a service</h2>
                <p className="mt-2 text-[#6d5863]">
                  Select the service you would like to book.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {services.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => {
                        setSelectedServiceId(service.id);
                        setSelectedTime("");
                      }}
                      className={`rounded-2xl border p-5 text-left transition ${
                        selectedServiceId === service.id
                          ? "border-[#d84b87] bg-[#fff0f6]"
                          : "border-[#f0dce5] bg-white hover:border-[#e9bfd0]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d84b87]">
                            {service.category}
                          </p>
                          <h3 className="mt-2 text-lg font-bold">{service.name}</h3>
                          <p className="mt-1 text-sm text-[#6d5863]">
                            {service.duration}
                          </p>
                        </div>
                        <p className="text-base font-bold text-[#2b1b25]">
                          ₹{service.price}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="mt-10">
                <h2 className="text-2xl font-bold">Choose your stylist</h2>
                <p className="mt-2 text-[#6d5863]">
                  Pick a preferred stylist or choose any available specialist.
                </p>

                <div className="mt-6 rounded-2xl border border-[#f0dce5] bg-[#fff0f6] p-4">
                  <button
                    type="button"
                    onClick={handleAnyStylistToggle}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      anyStylistMode
                        ? "border-[#d84b87] bg-white text-[#d84b87]"
                        : "border-[#f0dce5] bg-white text-[#2b1b25]"
                    }`}
                  >
                    <span className="block text-sm font-semibold uppercase tracking-[0.18em] text-[#d84b87]">
                      Any stylist
                    </span>
                    <span className="mt-1 block text-base font-medium">
                      Let the salon choose the next available eligible stylist.
                    </span>
                  </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {stylists.map((stylist) => (
                    <button
                      key={stylist.id}
                      type="button"
                      onClick={() => {
                        setAnyStylistMode(false);
                        setSelectedStylistId(stylist.id);
                        setSelectedTime("");
                      }}
                      className={`rounded-2xl border p-5 text-left transition ${
                        selectedStylistId === stylist.id
                          ? "border-[#d84b87] bg-[#fff0f6]"
                          : "border-[#f0dce5] bg-white hover:border-[#e9bfd0]"
                      }`}
                    >
                      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-pink-200 to-violet-200" />
                      <h3 className="mt-4 text-lg font-bold">{stylist.name}</h3>
                      <p className="mt-1 text-[#d84b87]">{stylist.role}</p>
                      <p className="mt-2 text-sm text-[#6d5863]">
                        {stylist.speciality}
                      </p>
                      <p className="mt-3 text-sm font-semibold">★ {stylist.rating}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="mt-10">
                <h2 className="text-2xl font-bold">Choose date and time</h2>
                <p className="mt-2 text-[#6d5863]">
                  Select a real slot available with your chosen stylist or any eligible stylist.
                </p>

                <div className="mt-6 space-y-6">
                  <div className="grid gap-3 md:grid-cols-4">
                    {availableDates.map((date) => (
                      <button
                        key={date.id}
                        type="button"
                        onClick={() => {
                          setSelectedDateId(date.id);
                          setSelectedTime("");
                        }}
                        className={`rounded-2xl border p-4 text-left transition ${
                          selectedDateId === date.id
                            ? "border-[#d84b87] bg-[#fff0f6]"
                            : "border-[#f0dce5] bg-white hover:border-[#e9bfd0]"
                        }`}
                      >
                        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#d84b87]">
                          {date.weekday}
                        </p>
                        <p className="mt-2 text-2xl font-bold">{date.day}</p>
                        <p className="text-sm text-[#6d5863]">{date.month}</p>
                      </button>
                    ))}
                  </div>

                  <div>
                    <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#d84b87]">
                      Available times
                    </p>

                    {isAvailabilityLoading ? (
                      <div className="rounded-2xl border border-[#f0dce5] bg-[#fff9fb] px-4 py-6 text-sm text-[#6d5863]">
                        Loading available times...
                      </div>
                    ) : availableSlots.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                        {availableSlots.map((time) => (
                          <button
                            key={time}
                            type="button"
                            onClick={() => handleTimeSelection(time)}
                            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                              selectedTime === time
                                ? "border-[#d84b87] bg-[#fff0f6] text-[#d84b87]"
                                : "border-[#f0dce5] bg-white text-[#2b1b25] hover:border-[#e9bfd0]"
                            }`}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-[#f0dce5] bg-[#fff9fb] px-4 py-6 text-sm text-[#6d5863]">
                        No available times for this day. Please try another date or stylist.
                      </div>
                    )}

                    {availabilityError ? (
                      <p className="mt-3 text-sm text-rose-600">{availabilityError}</p>
                    ) : null}
                  </div>
                </div>
              </section>
            )}

            {step === 4 && (
              <section className="mt-10">
                <h2 className="text-2xl font-bold">Tell us about your booking</h2>
                <p className="mt-2 text-[#6d5863]">
                  We will send your appointment request to the salon team.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-[#2b1b25]">
                    Full name
                    <input
                      aria-label="Full name"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-[#e9d4df] px-4 py-3 text-base outline-none transition focus:border-[#d84b87] focus:ring-2 focus:ring-[#f8c2d8]"
                      placeholder="Enter your full name"
                    />
                  </label>

                  <label className="block text-sm font-semibold text-[#2b1b25]">
                    Email address
                    <input
                      aria-label="Email address"
                      type="email"
                      value={customerEmail}
                      onChange={(event) => setCustomerEmail(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-[#e9d4df] px-4 py-3 text-base outline-none transition focus:border-[#d84b87] focus:ring-2 focus:ring-[#f8c2d8]"
                      placeholder="you@example.com"
                    />
                  </label>

                  <label className="block text-sm font-semibold text-[#2b1b25]">
                    Phone number
                    <input
                      aria-label="Phone number"
                      type="tel"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-[#e9d4df] px-4 py-3 text-base outline-none transition focus:border-[#d84b87] focus:ring-2 focus:ring-[#f8c2d8]"
                      placeholder="Optional"
                    />
                  </label>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-[#2b1b25]">
                      Notes for the salon
                      <textarea
                        aria-label="Notes for the salon"
                        value={customerNotes}
                        onChange={(event) => setCustomerNotes(event.target.value)}
                        className="mt-2 min-h-28 w-full rounded-xl border border-[#e9d4df] px-4 py-3 text-base outline-none transition focus:border-[#d84b87] focus:ring-2 focus:ring-[#f8c2d8]"
                        placeholder="Optional: preferences, allergies, or access needs"
                      />
                    </label>
                  </div>
                </div>
              </section>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 1}
                className="rounded-full border border-[#e9d4df] px-5 py-3 font-semibold text-[#2b1b25] transition hover:bg-[#fff0f6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>

              {step < 4 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={step === 3 ? !selectedDate || !selectedTime : !canContinue}
                  className="rounded-full bg-[#d84b87] px-6 py-3 font-semibold text-white transition hover:bg-[#bf356e] disabled:cursor-not-allowed disabled:bg-[#e9c4d6]"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={confirmBooking}
                  disabled={!bookingReady || isSubmitting}
                  className="rounded-full bg-[#d84b87] px-6 py-3 font-semibold text-white transition hover:bg-[#bf356e] disabled:cursor-not-allowed disabled:bg-[#e9c4d6]"
                >
                  {isSubmitting ? "Confirming..." : "Confirm booking"}
                </button>
              )}
            </div>

            {submitError && (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {submitError}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
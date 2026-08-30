 import Link from "next/link";
import CustomerNavbar from "@/components/layout/CustomerNavbar";
import Footer from "@/components/layout/Footer";

const features = [
  {
    title: "Easy online booking",
    description:
      "Choose a salon, service, preferred stylist, date, and time from one simple booking flow.",
  },
  {
    title: "Beauty inspiration",
    description:
      "Discover hairstyles, grooming looks, beauty ideas, and save your favourite styles for later.",
  },
  {
    title: "Built for salons",
    description:
      "Manage appointments, customers, staff availability, services, and salon growth in one dashboard.",
  },
];

export default function Home() {
  return (
    <>
      <CustomerNavbar />
      <main className="min-h-screen bg-[#fff9fb] text-[#2b1b25]">
        <section className="relative overflow-hidden bg-gradient-to-br from-[#fff0f6] via-[#fff9fb] to-[#f2ecff]">
        <div className="mx-auto flex min-h-[620px] max-w-7xl flex-col justify-center px-6 py-20 lg:px-8">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.24em] text-[#d84b87]">
            AI Salon &amp; Spa Platform
          </p>

          <h1 className="max-w-4xl text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            Your next beauty appointment,
            <span className="block text-[#d84b87]">
              beautifully simple.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#6d5863] sm:text-xl">
            Discover salons, choose your favourite stylist, book appointments,
            track your beauty journey, and find inspiration for your next look.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/salons"
              className="rounded-full bg-[#d84b87] px-7 py-4 text-center font-semibold text-white shadow-lg shadow-pink-200 transition hover:bg-[#bf356e]"
            >
              Explore salons
            </Link>

            <Link
              href="/salon/dashboard"
              className="rounded-full border border-[#d84b87] bg-white px-7 py-4 text-center font-semibold text-[#d84b87] transition hover:bg-[#fff0f6]"
            >
              Salon owner dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">
            One platform
          </p>

          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            Built for customers, stylists, and salon owners.
          </h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-3xl border border-[#f0dce5] bg-white p-7 shadow-sm"
            >
              <div className="mb-5 h-11 w-11 rounded-2xl bg-[#fff0f6]" />

              <h3 className="text-xl font-bold">{feature.title}</h3>

              <p className="mt-3 leading-7 text-[#6d5863]">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#2b1b25] px-6 py-20 text-white lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f6a8c7]">
            Coming next
          </p>

          <h2 className="mt-3 max-w-3xl text-3xl font-bold sm:text-4xl">
            Hairstyle inspiration, loyalty rewards, smart booking, and AI
            beauty experiences.
          </h2>
        </div>
      </section>
    </main>
      <Footer />
    </>
  );
}
import Link from "next/link";
import CustomerNavbar from "@/components/layout/CustomerNavbar";
import Footer from "@/components/layout/Footer";

type SalonPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const salonDetails = {
  "aura-studio": {
    name: "Aura Studio",
    location: "Belagavi, Karnataka",
    rating: "4.8",
    reviews: "126 reviews",
    description:
      "A premium salon experience for hair, beauty, grooming, and wellness services.",
    color: "from-pink-200 via-rose-100 to-purple-200",
  },
  "luxe-look": {
    name: "Luxe Look Salon",
    location: "Belagavi, Karnataka",
    rating: "4.7",
    reviews: "84 reviews",
    description:
      "Modern hair colour, styling, beauty treatments, and special-occasion looks.",
    color: "from-amber-100 via-rose-100 to-pink-200",
  },
  "glow-spa": {
    name: "Glow Spa & Wellness",
    location: "Belagavi, Karnataka",
    rating: "4.9",
    reviews: "62 reviews",
    description:
      "A calm wellness space for facials, spa rituals, relaxation, and self-care.",
    color: "from-violet-200 via-purple-100 to-pink-100",
  },
};

const services = [
  {
    name: "Women’s Haircut",
    duration: "45 min",
    price: "₹499",
    category: "Hair",
  },
  {
    name: "Men’s Haircut",
    duration: "30 min",
    price: "₹299",
    category: "Grooming",
  },
  {
    name: "Hair Spa",
    duration: "60 min",
    price: "₹999",
    category: "Hair Care",
  },
  {
    name: "Facial",
    duration: "60 min",
    price: "₹1,199",
    category: "Beauty",
  },
];

const stylists = [
  {
    name: "Ananya",
    role: "Hair Stylist",
    rating: "4.9",
    speciality: "Haircuts, styling & colour",
    color: "from-pink-300 to-purple-200",
  },
  {
    name: "Rahul",
    role: "Men’s Grooming Expert",
    rating: "4.8",
    speciality: "Haircuts, beard & grooming",
    color: "from-blue-200 to-violet-200",
  },
  {
    name: "Priya",
    role: "Beauty & Skin Specialist",
    rating: "4.9",
    speciality: "Facials, beauty & skincare",
    color: "from-rose-200 to-amber-100",
  },
];

export default async function SalonDetailPage({ params }: SalonPageProps) {
  const { slug } = await params;

  const salon =
    salonDetails[slug as keyof typeof salonDetails] ?? salonDetails["aura-studio"];

  return (
    <>
      <CustomerNavbar />
      <main className="min-h-screen bg-[#fff9fb] text-[#2b1b25]">
        <section className={`h-72 bg-gradient-to-br ${salon.color} sm:h-80`} />

      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <Link
          href="/salons"
          className="text-sm font-semibold text-[#d84b87] transition hover:text-[#bf356e]"
        >
          ← Back to salons
        </Link>

        <div className="mt-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">
              {salon.location}
            </p>

            <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
              {salon.name}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-[#fff0f6] px-4 py-2 text-sm font-semibold text-[#d84b87]">
                ★ {salon.rating}
              </span>

              <span className="text-sm text-[#6d5863]">{salon.reviews}</span>
            </div>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#6d5863]">
              {salon.description}
            </p>
          </div>

          <Link
            href={`/book/${slug}`}
            className="rounded-full bg-[#d84b87] px-7 py-4 text-center font-semibold text-white shadow-lg shadow-pink-200 transition hover:bg-[#bf356e]"
          >
            Book appointment
          </Link>
        </div>

        <section className="mt-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">
              Services
            </p>

            <h2 className="mt-3 text-3xl font-bold">Choose your service</h2>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {services.map((service) => (
              <article
                key={service.name}
                className="flex items-center justify-between rounded-2xl border border-[#f0dce5] bg-white p-5 shadow-sm"
              >
                <div>
                  <span className="rounded-full bg-[#fff0f6] px-3 py-1 text-xs font-semibold text-[#d84b87]">
                    {service.category}
                  </span>

                  <h3 className="mt-3 text-lg font-bold">{service.name}</h3>

                  <p className="mt-1 text-sm text-[#6d5863]">
                    {service.duration}
                  </p>
                </div>

                <p className="text-lg font-bold text-[#d84b87]">
                  {service.price}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">
              Our team
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              Meet the stylists
            </h2>
          </div>

          <div className="mt-7 grid gap-6 md:grid-cols-3">
            {stylists.map((stylist) => (
              <article
                key={stylist.name}
                className="rounded-3xl border border-[#f0dce5] bg-white p-6 shadow-sm"
              >
                <div
                  className={`h-20 w-20 rounded-full bg-gradient-to-br ${stylist.color}`}
                />

                <h3 className="mt-5 text-xl font-bold">{stylist.name}</h3>

                <p className="mt-1 font-medium text-[#d84b87]">
                  {stylist.role}
                </p>

                <p className="mt-3 text-sm leading-6 text-[#6d5863]">
                  {stylist.speciality}
                </p>

                <p className="mt-5 text-sm font-semibold text-[#2b1b25]">
                  ★ {stylist.rating}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-3xl bg-[#2b1b25] px-7 py-10 text-white sm:px-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f6a8c7]">
            Ready when you are
          </p>

          <h2 className="mt-3 max-w-2xl text-3xl font-bold">
            Choose a service, pick your stylist, and reserve your preferred
            time.
          </h2>

          <Link
            href={`/book/${slug}`}
            className="mt-7 inline-block rounded-full bg-[#d84b87] px-7 py-4 font-semibold text-white transition hover:bg-[#ef5d9d]"
          >
            Start booking
          </Link>
        </section>
        </section>
      </main>
      <Footer />
    </>
  );
}
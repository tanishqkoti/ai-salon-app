import Link from "next/link";
import CustomerNavbar from "@/components/layout/CustomerNavbar";
import Footer from "@/components/layout/Footer";

const salons = [
  {
    id: "aura-studio",
    name: "Aura Studio",
    location: "Belagavi, Karnataka",
    rating: "4.8",
    reviews: "126 reviews",
    speciality: "Hair, beauty & spa",
    price: "From ₹299",
    color: "from-pink-200 via-rose-100 to-purple-200",
  },
  {
    id: "luxe-look",
    name: "Luxe Look Salon",
    location: "Belagavi, Karnataka",
    rating: "4.7",
    reviews: "84 reviews",
    speciality: "Hair colour & styling",
    price: "From ₹399",
    color: "from-amber-100 via-rose-100 to-pink-200",
  },
  {
    id: "glow-spa",
    name: "Glow Spa & Wellness",
    location: "Belagavi, Karnataka",
    rating: "4.9",
    reviews: "62 reviews",
    speciality: "Facial, spa & relaxation",
    price: "From ₹499",
    color: "from-violet-200 via-purple-100 to-pink-100",
  },
];

export default function SalonsPage() {
  return (
    <>
      <CustomerNavbar />
      <main className="min-h-screen bg-[#fff9fb] px-6 py-12 text-[#2b1b25] lg:px-8">
        <div className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="text-sm font-semibold text-[#d84b87] transition hover:text-[#bf356e]"
        >
          ← Back to home
        </Link>

        <p className="mt-10 text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">
          Discover beauty
        </p>

        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
          Find a salon you&apos;ll love.
        </h1>

        <p className="mt-4 max-w-2xl text-lg leading-8 text-[#6d5863]">
          Browse partner salons, compare services, choose a stylist, and book
          your next appointment online.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {salons.map((salon) => (
            <article
              key={salon.id}
              className="overflow-hidden rounded-3xl border border-[#f0dce5] bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className={`h-52 bg-gradient-to-br ${salon.color}`} />

              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">{salon.name}</h2>

                    <p className="mt-1 text-sm text-[#6d5863]">
                      {salon.location}
                    </p>
                  </div>

                  <span className="whitespace-nowrap rounded-full bg-[#fff0f6] px-3 py-1 text-sm font-semibold text-[#d84b87]">
                    ★ {salon.rating}
                  </span>
                </div>

                <p className="mt-5 font-medium">{salon.speciality}</p>

                <p className="mt-1 text-sm text-[#6d5863]">
                  {salon.price} · {salon.reviews}
                </p>

                <Link
                  href={`/salons/${salon.id}`}
                  className="mt-6 block rounded-full bg-[#2b1b25] px-5 py-3 text-center font-semibold text-white transition hover:bg-[#4a303e]"
                >
                  View salon
                </Link>
              </div>
            </article>
          ))}
        </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
import SalonDashboardHeader from "@/components/layout/SalonDashboardHeader";
import SalonSidebar from "@/components/layout/SalonSidebar";

const services = [
  { name: "Women’s Haircut", duration: "45 min", price: "₹499", status: "Active", staff: ["Ananya", "Rahul"] },
  { name: "Men’s Haircut", duration: "30 min", price: "₹299", status: "Active", staff: ["Rahul"] },
  { name: "Hair Spa", duration: "60 min", price: "₹999", status: "Popular", staff: ["Ananya"] },
  { name: "Facial", duration: "60 min", price: "₹1,199", status: "Paused", staff: ["Priya"] },
];

export default function SalonServicesPage() {
  return (
    <>
      <SalonDashboardHeader />
      <main className="min-h-screen bg-[#fff9fb] text-[#2b1b25]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[230px_1fr] lg:px-8">
          <SalonSidebar />

          <section className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">Services</p>
                <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Service menu</h1>
              </div>

              <button type="button" className="rounded-full bg-[#d84b87] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#bf356e]">
                + Add service
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {services.map((service) => (
                <article key={service.name} className="rounded-3xl border border-[#f0dce5] bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d84b87]">Hair care</p>
                      <h2 className="mt-2 text-2xl font-bold">{service.name}</h2>
                    </div>

                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      service.status === "Paused"
                        ? "bg-rose-50 text-rose-700"
                        : service.status === "Popular"
                          ? "bg-violet-50 text-violet-700"
                          : "bg-emerald-50 text-emerald-700"
                    }`}>
                      {service.status}
                    </span>
                  </div>

                  <div className="mt-6 flex items-center justify-between text-sm text-[#6d5863]">
                    <span>{service.duration}</span>
                    <span className="text-lg font-bold text-[#d84b87]">{service.price}</span>
                  </div>

                  <div className="mt-6 border-t border-[#f0dce5] pt-4">
                    <p className="text-sm font-semibold text-[#2b1b25]">Assigned staff</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {service.staff.map((member) => (
                        <span key={member} className="rounded-full bg-[#fff0f6] px-3 py-1 text-xs font-semibold text-[#d84b87]">
                          {member}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

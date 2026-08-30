import SalonDashboardHeader from "@/components/layout/SalonDashboardHeader";
import SalonSidebar from "@/components/layout/SalonSidebar";

const performance = [
  { name: "Mon", value: 50 },
  { name: "Tue", value: 65 },
  { name: "Wed", value: 48 },
  { name: "Thu", value: 76 },
  { name: "Fri", value: 82 },
  { name: "Sat", value: 90 },
];

export default function SalonAnalyticsPage() {
  return (
    <>
      <SalonDashboardHeader />
      <main className="min-h-screen bg-[#fff9fb] text-[#2b1b25]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[230px_1fr] lg:px-8">
          <SalonSidebar />

          <section className="space-y-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">Analytics</p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Salon performance</h1>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Revenue", value: "₹84,200" },
                { label: "Bookings", value: "146" },
                { label: "Avg. basket", value: "₹1,280" },
                { label: "Repeat rate", value: "68%" },
              ].map((item) => (
                <article key={item.label} className="rounded-2xl border border-[#f0dce5] bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-[#6d5863]">{item.label}</p>
                  <p className="mt-3 text-3xl font-bold text-[#2b1b25]">{item.value}</p>
                </article>
              ))}
            </div>

            <section className="rounded-3xl border border-[#f0dce5] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">Weekly bookings</h2>
              <div className="mt-6 flex h-56 items-end gap-3">
                {performance.map((bar) => (
                  <div key={bar.name} className="flex flex-1 flex-col items-center gap-3">
                    <div className="w-full rounded-t-2xl bg-gradient-to-t from-[#d84b87] to-[#f4a4c6]" style={{ height: `${bar.value}%` }} />
                    <span className="text-xs font-semibold text-[#6d5863]">{bar.name}</span>
                  </div>
                ))}
              </div>
            </section>
          </section>
        </div>
      </main>
    </>
  );
}

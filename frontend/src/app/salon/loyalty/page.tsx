import SalonDashboardHeader from "@/components/layout/SalonDashboardHeader";
import SalonSidebar from "@/components/layout/SalonSidebar";

const rewards = [
  { name: "Silver Glow", points: "500 pts", description: "Free haircut or beard trim" },
  { name: "Gold Ritual", points: "1,200 pts", description: "20% off premium facial or spa" },
  { name: "VIP Beauty Club", points: "2,500 pts", description: "Complimentary styling review" },
];

export default function SalonLoyaltyPage() {
  return (
    <>
      <SalonDashboardHeader />
      <main className="min-h-screen bg-[#fff9fb] text-[#2b1b25]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[230px_1fr] lg:px-8">
          <SalonSidebar />

          <section className="space-y-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">Loyalty & VIP</p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Reward program</h1>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Active members", value: "1,248" },
                { label: "VIPs", value: "186" },
                { label: "Points issued", value: "42,800" },
                { label: "Redeemed", value: "18,200" },
              ].map((item) => (
                <article key={item.label} className="rounded-2xl border border-[#f0dce5] bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-[#6d5863]">{item.label}</p>
                  <p className="mt-3 text-3xl font-bold text-[#2b1b25]">{item.value}</p>
                </article>
              ))}
            </div>

            <section className="rounded-3xl border border-[#f0dce5] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">Reward tiers</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {rewards.map((reward) => (
                  <article key={reward.name} className="rounded-2xl bg-[#fff9fb] p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#d84b87]">{reward.points}</p>
                    <h3 className="mt-3 text-xl font-bold">{reward.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#6d5863]">{reward.description}</p>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </div>
      </main>
    </>
  );
}

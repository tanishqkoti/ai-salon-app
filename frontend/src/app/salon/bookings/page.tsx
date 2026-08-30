import Link from "next/link";
import SalonDashboardHeader from "@/components/layout/SalonDashboardHeader";
import SalonSidebar from "@/components/layout/SalonSidebar";

const bookings = [
  { id: 1021, customer: "Aarav Patil", service: "Men’s Haircut", stylist: "Rahul", time: "Tue, 10:00 AM", status: "Confirmed" },
  { id: 1022, customer: "Meera Kulkarni", service: "Hair Spa", stylist: "Ananya", time: "Tue, 11:30 AM", status: "Pending" },
  { id: 1023, customer: "Ishita Desai", service: "Facial", stylist: "Priya", time: "Tue, 2:00 PM", status: "Completed" },
  { id: 1024, customer: "Rohan Shetty", service: "Men’s Haircut", stylist: "Rahul", time: "Wed, 4:30 PM", status: "Cancelled" },
];

const statusStyles: Record<string, string> = {
  Confirmed: "bg-blue-50 text-blue-700",
  Pending: "bg-amber-50 text-amber-700",
  Completed: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-rose-50 text-rose-700",
};

export default function SalonBookingsPage() {
  return (
    <>
      <SalonDashboardHeader />
      <main className="min-h-screen bg-[#fff9fb] text-[#2b1b25]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[230px_1fr] lg:px-8">
          <SalonSidebar />

          <section className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">Bookings</p>
                <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Appointment calendar</h1>
              </div>

              <Link href="/salon/dashboard" className="inline-flex rounded-full bg-[#d84b87] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#bf356e]">
                + New booking
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { name: "Pending", value: "12", tone: "text-amber-600" },
                { name: "Confirmed", value: "24", tone: "text-blue-600" },
                { name: "Completed", value: "38", tone: "text-emerald-600" },
                { name: "Cancelled", value: "4", tone: "text-rose-600" },
              ].map((card) => (
                <article key={card.name} className="rounded-2xl border border-[#f0dce5] bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-[#6d5863]">{card.name}</p>
                  <p className={`mt-3 text-3xl font-bold ${card.tone}`}>{card.value}</p>
                </article>
              ))}
            </div>

            <section className="overflow-hidden rounded-3xl border border-[#f0dce5] bg-white shadow-sm">
              <div className="border-b border-[#f0dce5] px-6 py-5">
                <h2 className="text-xl font-bold">Recent bookings</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead className="bg-[#fff9fb] text-sm text-[#6d5863]">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Customer</th>
                      <th className="px-6 py-4 font-semibold">Service</th>
                      <th className="px-6 py-4 font-semibold">Stylist</th>
                      <th className="px-6 py-4 font-semibold">Time</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((booking) => (
                      <tr key={booking.id} className="border-t border-[#f6e8ee] text-sm">
                        <td className="px-6 py-5">
                          <p className="font-semibold">{booking.customer}</p>
                          <p className="mt-1 text-[#6d5863]">#{booking.id}</p>
                        </td>
                        <td className="px-6 py-5">{booking.service}</td>
                        <td className="px-6 py-5">{booking.stylist}</td>
                        <td className="px-6 py-5 font-medium">{booking.time}</td>
                        <td className="px-6 py-5">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[booking.status]}`}>
                            {booking.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        </div>
      </main>
    </>
  );
}

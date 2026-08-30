"use client";

import Link from "next/link";
import SalonDashboardHeader from "@/components/layout/SalonDashboardHeader";
import SalonSidebar from "@/components/layout/SalonSidebar";
import { useMemo, useState } from "react";

type CustomerStatus = "VIP" | "Regular" | "New";

type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string;
  visits: number;
  totalSpent: number;
  loyaltyPoints: number;
  preferredStylist: string;
  lastVisit: string;
  status: CustomerStatus;
  serviceHistory: string[];
};

const initialCustomers: Customer[] = [
  {
    id: 1,
    name: "Aarav Patil",
    email: "aarav@example.com",
    phone: "+91 98765 43210",
    visits: 8,
    totalSpent: 4950,
    loyaltyPoints: 495,
    preferredStylist: "Rahul",
    lastVisit: "28 Aug 2026",
    status: "VIP",
    serviceHistory: [
      "Men’s Haircut — 28 Aug 2026",
      "Beard Grooming — 10 Aug 2026",
      "Men’s Haircut — 12 Jul 2026",
    ],
  },
  {
    id: 2,
    name: "Meera Kulkarni",
    email: "meera@example.com",
    phone: "+91 98765 43211",
    visits: 5,
    totalSpent: 6280,
    loyaltyPoints: 628,
    preferredStylist: "Ananya",
    lastVisit: "25 Aug 2026",
    status: "VIP",
    serviceHistory: [
      "Hair Spa — 25 Aug 2026",
      "Women’s Haircut — 03 Aug 2026",
      "Hair Colour — 11 Jul 2026",
    ],
  },
  {
    id: 3,
    name: "Ishita Desai",
    email: "ishita@example.com",
    phone: "+91 98765 43212",
    visits: 3,
    totalSpent: 3597,
    loyaltyPoints: 359,
    preferredStylist: "Priya",
    lastVisit: "20 Aug 2026",
    status: "Regular",
    serviceHistory: [
      "Facial — 20 Aug 2026",
      "Cleanup — 28 Jul 2026",
      "Facial — 03 Jul 2026",
    ],
  },
  {
    id: 4,
    name: "Rohan Shetty",
    email: "rohan@example.com",
    phone: "+91 98765 43213",
    visits: 2,
    totalSpent: 598,
    loyaltyPoints: 59,
    preferredStylist: "Rahul",
    lastVisit: "30 Aug 2026",
    status: "Regular",
    serviceHistory: [
      "Men’s Haircut — 30 Aug 2026",
      "Men’s Haircut — 15 Jul 2026",
    ],
  },
  {
    id: 5,
    name: "Nisha Jain",
    email: "nisha@example.com",
    phone: "+91 98765 43214",
    visits: 1,
    totalSpent: 499,
    loyaltyPoints: 49,
    preferredStylist: "Ananya",
    lastVisit: "19 Aug 2026",
    status: "New",
    serviceHistory: ["Women’s Haircut — 19 Aug 2026"],
  },
];

const statusStyles: Record<CustomerStatus, string> = {
  VIP: "bg-purple-100 text-purple-700",
  Regular: "bg-blue-50 text-blue-700",
  New: "bg-emerald-50 text-emerald-700",
};

export default function CustomersPage() {
  const [customers] = useState<Customer[]>(initialCustomers);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"All" | CustomerStatus>(
    "All"
  );
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        customer.name.toLowerCase().includes(normalizedQuery) ||
        customer.email.toLowerCase().includes(normalizedQuery) ||
        customer.phone.includes(normalizedQuery);

      const matchesStatus =
        selectedStatus === "All" || customer.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [customers, searchQuery, selectedStatus]);

  const stats = useMemo(() => {
    return {
      total: customers.length,
      vip: customers.filter((customer) => customer.status === "VIP").length,
      regular: customers.filter((customer) => customer.status === "Regular")
        .length,
      points: customers.reduce(
        (total, customer) => total + customer.loyaltyPoints,
        0
      ),
    };
  }, [customers]);

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
                  Customer database
                </p>

                <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
                  Your salon customers
                </h1>

                <p className="mt-4 max-w-2xl text-lg leading-8 text-[#6d5863]">
                  View customer details, visit history, favourite stylists,
                  loyalty points, spending, and VIP status.
                </p>
              </div>

              <button className="rounded-full bg-[#d84b87] px-5 py-3 font-semibold text-white transition hover:bg-[#bf356e]">
                + Add customer
              </button>
            </div>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-[#f0dce5] bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-[#6d5863]">
                  Total customers
                </p>
                <p className="mt-3 text-3xl font-bold">{stats.total}</p>
              </article>

              <article className="rounded-2xl border border-[#f0dce5] bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-[#6d5863]">
                  VIP customers
                </p>
                <p className="mt-3 text-3xl font-bold text-purple-600">
                  {stats.vip}
                </p>
              </article>

              <article className="rounded-2xl border border-[#f0dce5] bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-[#6d5863]">
                  Regular customers
                </p>
                <p className="mt-3 text-3xl font-bold text-blue-600">
                  {stats.regular}
                </p>
              </article>

              <article className="rounded-2xl border border-[#f0dce5] bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-[#6d5863]">
                  Total loyalty points
                </p>
                <p className="mt-3 text-3xl font-bold text-[#d84b87]">
                  {stats.points.toLocaleString("en-IN")}
                </p>
              </article>
            </section>

            <section className="overflow-hidden rounded-3xl border border-[#f0dce5] bg-white shadow-sm">
              <div className="border-b border-[#f0dce5] p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Customer list</h2>
                    <p className="mt-1 text-sm text-[#6d5863]">
                      Select a customer to view their salon journey.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search name, email, or phone"
                      className="rounded-xl border border-[#e9d4df] px-4 py-3 text-sm outline-none transition focus:border-[#d84b87] focus:ring-2 focus:ring-[#f8c2d8]"
                    />

                    <select
                      value={selectedStatus}
                      onChange={(event) =>
                        setSelectedStatus(
                          event.target.value as "All" | CustomerStatus
                        )
                      }
                      className="rounded-xl border border-[#e9d4df] bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-[#d84b87] focus:ring-2 focus:ring-[#f8c2d8]"
                    >
                      <option value="All">All customers</option>
                      <option value="VIP">VIP customers</option>
                      <option value="Regular">Regular customers</option>
                      <option value="New">New customers</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left">
                  <thead className="bg-[#fff9fb] text-sm text-[#6d5863]">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Customer</th>
                      <th className="px-6 py-4 font-semibold">Visits</th>
                      <th className="px-6 py-4 font-semibold">Total spent</th>
                      <th className="px-6 py-4 font-semibold">Loyalty</th>
                      <th className="px-6 py-4 font-semibold">
                        Preferred stylist
                      </th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredCustomers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="border-t border-[#f6e8ee] text-sm"
                      >
                        <td className="px-6 py-5">
                          <p className="font-semibold">{customer.name}</p>
                          <p className="mt-1 text-[#6d5863]">{customer.email}</p>
                          <p className="mt-1 text-[#6d5863]">{customer.phone}</p>
                        </td>

                        <td className="px-6 py-5">
                          <p className="font-semibold">{customer.visits}</p>
                          <p className="mt-1 text-xs text-[#6d5863]">
                            Last: {customer.lastVisit}
                          </p>
                        </td>

                        <td className="px-6 py-5 font-semibold">
                          ₹{customer.totalSpent.toLocaleString("en-IN")}
                        </td>

                        <td className="px-6 py-5">
                          <span className="rounded-full bg-[#fff0f6] px-3 py-1 text-xs font-semibold text-[#d84b87]">
                            {customer.loyaltyPoints} points
                          </span>
                        </td>

                        <td className="px-6 py-5">{customer.preferredStylist}</td>

                        <td className="px-6 py-5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[customer.status]}`}
                          >
                            {customer.status}
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          <button
                            type="button"
                            onClick={() => setSelectedCustomer(customer)}
                            className="rounded-lg bg-[#2b1b25] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#4a303e]"
                          >
                            View profile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredCustomers.length === 0 && (
                <div className="p-10 text-center">
                  <p className="font-semibold">No customers found.</p>
                  <p className="mt-2 text-sm text-[#6d5863]">
                    Try another name, email, phone number, or customer type.
                  </p>
                </div>
              )}
            </section>

            {selectedCustomer && (
              <section className="rounded-3xl border border-[#f0dce5] bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">
                      Customer profile
                    </p>

                    <h2 className="mt-3 text-3xl font-bold">
                      {selectedCustomer.name}
                    </h2>

                    <p className="mt-2 text-[#6d5863]">
                      {selectedCustomer.email} · {selectedCustomer.phone}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="rounded-full border border-[#e9d4df] px-4 py-2 text-sm font-semibold text-[#6d5863] transition hover:bg-[#fff0f6]"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <article className="rounded-2xl bg-[#fff9fb] p-4">
                    <p className="text-sm text-[#6d5863]">Visits</p>
                    <p className="mt-2 text-2xl font-bold">
                      {selectedCustomer.visits}
                    </p>
                  </article>

                  <article className="rounded-2xl bg-[#fff9fb] p-4">
                    <p className="text-sm text-[#6d5863]">Total spent</p>
                    <p className="mt-2 text-2xl font-bold">
                      ₹{selectedCustomer.totalSpent.toLocaleString("en-IN")}
                    </p>
                  </article>

                  <article className="rounded-2xl bg-[#fff9fb] p-4">
                    <p className="text-sm text-[#6d5863]">Loyalty points</p>
                    <p className="mt-2 text-2xl font-bold text-[#d84b87]">
                      {selectedCustomer.loyaltyPoints}
                    </p>
                  </article>

                  <article className="rounded-2xl bg-[#fff9fb] p-4">
                    <p className="text-sm text-[#6d5863]">
                      Preferred stylist
                    </p>
                    <p className="mt-2 text-2xl font-bold">
                      {selectedCustomer.preferredStylist}
                    </p>
                  </article>
                </div>

                <div className="mt-8">
                  <h3 className="text-xl font-bold">Service history</h3>

                  <div className="mt-4 grid gap-3">
                    {selectedCustomer.serviceHistory.map((service) => (
                      <div
                        key={service}
                        className="rounded-xl border border-[#f0dce5] bg-[#fff9fb] px-4 py-3 text-sm font-medium"
                      >
                        {service}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
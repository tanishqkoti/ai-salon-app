"use client";

import Link from "next/link";
import SalonDashboardHeader from "@/components/layout/SalonDashboardHeader";
import SalonSidebar from "@/components/layout/SalonSidebar";
import CreateCustomerControl from "@/components/dashboard/CreateCustomerControl";
import LifecycleAction from "@/components/dashboard/LifecycleAction";
import { archiveCustomer, getCustomers, type CustomerApiRecord } from "@/lib/api/customers";
import { useEffect, useMemo, useState } from "react";

type CustomerStatus = "VIP" | "Regular" | "New";

type Customer = {
  id: number | string;
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
  isActive: boolean;
};

const statusStyles: Record<CustomerStatus, string> = {
  VIP: "bg-purple-100 text-purple-700",
  Regular: "bg-blue-50 text-blue-700",
  New: "bg-emerald-50 text-emerald-700",
};

function mapCustomer(record: CustomerApiRecord): Customer {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    phone: record.phone,
    visits: record.visits,
    totalSpent: record.total_spent,
    loyaltyPoints: record.loyalty_points,
    preferredStylist: record.preferred_stylist,
    lastVisit: record.last_visit || "No visits yet",
    status: record.status as CustomerStatus,
    serviceHistory: record.service_history,
    isActive: record.is_active !== false,
  };
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"All" | CustomerStatus>(
    "All"
  );
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    async function loadCustomers() {
      setIsLoading(true);
      setError("");

      try {
        const response = await getCustomers();
        setCustomers(response.customers.map(mapCustomer));
      } catch (loadError) {
        setCustomers([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load customers."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const normalize = (value: string) => value.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        normalize(customer.name).includes(normalizedQuery) ||
        normalize(customer.email).includes(normalizedQuery) ||
        normalize(customer.phone).includes(normalizedQuery);

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

  function addCreatedCustomer(record: CustomerApiRecord) {
    setCustomers((currentCustomers) => [mapCustomer(record), ...currentCustomers]);
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

              <CreateCustomerControl onCreated={addCreatedCustomer} />
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

              {error && (
                <div role="alert" className="border-b border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700">
                  {error}
                </div>
              )}

              {isLoading ? (
                <div className="px-6 py-10 text-sm text-[#6d5863]">Loading customers...</div>
              ) : (
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
                            {customer.isActive ? customer.status : "Archived"}
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedCustomer(customer)}
                              className="rounded-lg bg-[#2b1b25] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#4a303e]"
                            >
                              View profile
                            </button>
                            {customer.isActive && (
                              <LifecycleAction
                                actionLabel="Archive customer"
                                onConfirm={async () => {
                                  const result = await archiveCustomer(String(customer.id));
                                  setCustomers((current) => current.map((item) => item.id === customer.id ? mapCustomer(result.customer) : item));
                                }}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}

              {!isLoading && !error && filteredCustomers.length === 0 && (
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
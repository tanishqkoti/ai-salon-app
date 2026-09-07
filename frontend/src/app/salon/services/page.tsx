"use client";

import { useEffect, useState } from "react";
import SalonDashboardHeader from "@/components/layout/SalonDashboardHeader";
import SalonSidebar from "@/components/layout/SalonSidebar";
import CreateServiceControl from "@/components/dashboard/CreateServiceControl";
import LifecycleAction from "@/components/dashboard/LifecycleAction";
import { archiveService, getServices, type ServiceApiRecord } from "@/lib/api/services";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  status: string;
  staff: string[];
  isActive: boolean;
  isDemo: boolean;
};

const initialServices: Service[] = [
  { id: "women-haircut", name: "Women’s Haircut", duration_minutes: 45, price: 499, status: "Active", staff: ["Ananya", "Rahul"], isActive: true, isDemo: true },
  { id: "men-haircut", name: "Men’s Haircut", duration_minutes: 30, price: 299, status: "Active", staff: ["Rahul"], isActive: true, isDemo: true },
  { id: "hair-spa", name: "Hair Spa", duration_minutes: 60, price: 999, status: "Popular", staff: ["Ananya"], isActive: true, isDemo: true },
  { id: "facial", name: "Facial", duration_minutes: 60, price: 1199, status: "Paused", staff: ["Priya"], isActive: true, isDemo: true },
];

function mapService(record: ServiceApiRecord): Service {
  return {
    id: record.id,
    name: record.name,
    duration_minutes: record.duration_minutes,
    price: record.price,
    status: record.status,
    staff: record.staff,
    isActive: record.is_active !== false,
    isDemo: false,
  };
}

function mergeServices(exampleServices: Service[], savedServices: ServiceApiRecord[]) {
  const merged = [...exampleServices];
  const existingIds = new Set(merged.map((service) => String(service.id)));
  const existingNames = new Set(merged.map((service) => service.name.trim().toLowerCase()));

  for (const savedService of savedServices) {
    const mappedService = mapService(savedService);
    const hasStableId = Boolean(String(mappedService.id).trim());
    const duplicate = hasStableId
      ? existingIds.has(String(mappedService.id))
      : existingNames.has(mappedService.name.trim().toLowerCase());
    if (!duplicate) {
      merged.push(mappedService);
      existingIds.add(String(mappedService.id));
      existingNames.add(mappedService.name.trim().toLowerCase());
    }
  }

  return merged;
}

export default function SalonServicesPage() {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadError, setLoadError] = useState("");

  const filteredServices = services.filter((service) =>
    service.name.trim().toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  useEffect(() => {
    let isActive = true;

    async function loadServices() {
      try {
        const response = await getServices();
        if (isActive) {
          setServices(mergeServices(initialServices, response.services));
          setLoadError("");
        }
      } catch (error) {
        if (isActive) {
          setServices(initialServices);
          setLoadError(error instanceof Error ? error.message : "Unable to load saved services.");
        }
      }
    }

    loadServices();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") loadServices();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      isActive = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  function addCreatedService(record: ServiceApiRecord) {
    setServices((currentServices) => mergeServices(currentServices, [record]));
  }

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

              <CreateServiceControl onCreated={addCreatedService} />
            </div>

            {loadError && (
              <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {loadError} Example services are still shown.
              </p>
            )}

            <label className="grid gap-2 text-sm font-semibold sm:max-w-sm">
              Search services
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search service name"
                className="rounded-xl border border-[#e9d4df] bg-white px-4 py-3 font-normal outline-none focus:border-[#d84b87]"
              />
            </label>

              <div className="grid gap-4 md:grid-cols-2">
              {filteredServices.map((service) => (
                <article key={service.id} className="rounded-3xl border border-[#f0dce5] bg-white p-6 shadow-sm">
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
                      {service.isActive ? service.status : "Archived"}
                    </span>
                  </div>

                  <div className="mt-6 flex items-center justify-between text-sm text-[#6d5863]">
                    <span>{service.duration_minutes} min</span>
                    <span className="text-lg font-bold text-[#d84b87]">₹{service.price.toLocaleString("en-IN")}</span>
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

                  {!service.isDemo && service.isActive && (
                    <div className="mt-5">
                      <LifecycleAction
                        actionLabel="Archive service"
                        onConfirm={async () => {
                          const result = await archiveService(String(service.id));
                          setServices((current) => current.map((item) => item.id === service.id ? mapService(result.service) : item));
                        }}
                      />
                    </div>
                  )}
                </article>
              ))}
            </div>
            {filteredServices.length === 0 && (
              <p className="rounded-2xl border border-[#f0dce5] bg-white p-6 text-sm text-[#6d5863]">
                No services found.
              </p>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

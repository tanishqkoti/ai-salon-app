"use client";

import { FormEvent, useState } from "react";
import { createCustomer, type CustomerApiRecord } from "@/lib/api/customers";

type Props = { onCreated: (customer: CustomerApiRecord) => void };

export default function CreateCustomerControl({ onCreated }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", preferred_stylist: "" });

  function close() {
    if (!isCreating) setIsOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsCreating(true);
    try {
      const result = await createCustomer(form);
      onCreated(result.customer);
      setSuccess("Customer created successfully.");
      setForm({ name: "", email: "", phone: "", preferred_stylist: "" });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create customer.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setIsOpen(true); setError(""); setSuccess(""); }} className="rounded-full bg-[#d84b87] px-5 py-3 font-semibold text-white transition hover:bg-[#bf356e]">
        + Add customer
      </button>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b1b25]/40 px-4 py-8" role="presentation">
          <form onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-labelledby="create-customer-title" className="w-full max-w-lg rounded-3xl border border-[#f0dce5] bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d84b87]">Customer</p><h2 id="create-customer-title" className="mt-2 text-2xl font-bold">Add customer</h2></div>
              <button type="button" onClick={close} className="rounded-full border border-[#e9d4df] px-3 py-2 text-sm font-semibold text-[#6d5863]">Close</button>
            </div>
            <div className="mt-6 grid gap-4">
              {(["name", "email", "phone", "preferred_stylist"] as const).map((field) => (
                <label key={field} className="grid gap-2 text-sm font-semibold">{field === "preferred_stylist" ? "Preferred stylist" : field[0].toUpperCase() + field.slice(1)}{field !== "preferred_stylist" && <span className="text-[#d84b87]"> *</span>}
                  <input required={field !== "preferred_stylist"} type={field === "email" ? "email" : "text"} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} className="rounded-xl border border-[#e9d4df] px-4 py-3 font-normal outline-none focus:border-[#d84b87]" />
                </label>
              ))}
            </div>
            {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
            {success && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>}
            <button type="submit" disabled={isCreating} className="mt-6 w-full rounded-full bg-[#d84b87] px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{isCreating ? "Creating..." : "Create customer"}</button>
          </form>
        </div>
      )}
    </>
  );
}

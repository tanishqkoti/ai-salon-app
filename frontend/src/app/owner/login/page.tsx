"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase";

export default function OwnerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      const token = await credential.user.getIdToken();
      const response = await fetch("/api/owner/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const body = (await response.json()) as { detail?: string };
        throw new Error(body.detail || "You are not authorized to manage a salon.");
      }

      const nextPath = new URLSearchParams(window.location.search).get("next");
      router.replace(nextPath || "/salon/bookings");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fff9fb] px-4 py-12 text-[#2b1b25]">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl border border-[#f0dce5] bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">GlowBook for Business</p>
        <h1 className="mt-3 text-3xl font-bold">Owner sign in</h1>
        <p className="mt-2 text-sm text-[#6d5863]">Sign in with the Firebase account assigned to your salon.</p>

        <div className="mt-8 grid gap-5">
          <label className="grid gap-2 text-sm font-semibold">Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-xl border border-[#e9d4df] px-4 py-3 outline-none focus:border-[#d84b87]" /></label>
          <label className="grid gap-2 text-sm font-semibold">Password<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-xl border border-[#e9d4df] px-4 py-3 outline-none focus:border-[#d84b87]" /></label>
        </div>

        {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="mt-7 w-full rounded-full bg-[#d84b87] px-5 py-3 font-semibold text-white transition hover:bg-[#bf356e] disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "Signing in..." : "Sign in"}</button>
      </form>
    </main>
  );
}
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SalonDashboardHeader() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/owner/logout', { method: 'POST' });
    router.replace('/owner/login');
  }

  return (
    <header className="border-b border-[#f0dce5] bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d84b87]">
            GlowBook for Business
          </p>
          <h1 className="mt-1 text-xl font-bold text-[#2b1b25]">Aura Studio Dashboard</h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex rounded-full border border-[#e9d4df] px-4 py-2 text-sm font-semibold text-[#6d5863] transition hover:bg-[#fff0f6]"
          >
            View customer site
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-[#e9d4df] px-4 py-2 text-sm font-semibold text-[#6d5863] transition hover:bg-[#fff0f6]"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}

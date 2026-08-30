'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Salons', href: '/salons' },
  { label: 'Book', href: '/salons' },
  { label: 'Inspiration', href: '/inspiration' },
  { label: 'Dashboard', href: '/customer/dashboard' },
];

export default function CustomerNavbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[#f0dce5] bg-[#fff9fb]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d84b87] to-[#7f4fc7] text-lg font-bold text-white shadow-lg shadow-pink-200">
            G
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d84b87]">
              GlowBook
            </p>
            <p className="text-sm font-bold text-[#2b1b25]">Beauty booking</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition ${
                  isActive ? 'text-[#d84b87]' : 'text-[#6d5863] hover:text-[#2b1b25]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/salons"
            className="hidden rounded-full border border-[#e9d4df] px-4 py-2 text-sm font-semibold text-[#2b1b25] transition hover:bg-[#fff0f6] sm:inline-flex"
          >
            Explore salons
          </Link>
          <Link
            href="/book/aura-studio"
            className="inline-flex rounded-full bg-[#d84b87] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-200 transition hover:bg-[#bf356e]"
          >
            Book now
          </Link>
        </div>
      </div>
    </header>
  );
}

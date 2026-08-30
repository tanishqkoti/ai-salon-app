'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { label: 'Overview', href: '/salon/dashboard' },
  { label: 'Bookings', href: '/salon/bookings' },
  { label: 'Customers', href: '/salon/customers' },
  { label: 'Staff & Availability', href: '/salon/staff' },
  { label: 'Services', href: '/salon/services' },
  { label: 'Loyalty & VIP', href: '/salon/loyalty' },
  { label: 'Analytics', href: '/salon/analytics' },
  { label: 'Settings', href: '/salon/settings' },
];

export default function SalonSidebar() {
  const pathname = usePathname();

  return (
    <aside className="rounded-3xl border border-[#f0dce5] bg-white p-4 shadow-sm lg:h-fit">
      <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {items.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                isActive
                  ? 'bg-[#fff0f6] text-[#d84b87]'
                  : 'text-[#6d5863] hover:bg-[#fff0f6] hover:text-[#2b1b25]'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

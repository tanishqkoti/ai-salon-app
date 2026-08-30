import Link from 'next/link';

const footerLinks = {
  Explore: [
    { label: 'Salons', href: '/salons' },
    { label: 'Inspiration', href: '/inspiration' },
    { label: 'Saved styles', href: '/saved-styles' },
  ],
  Company: [
    { label: 'About', href: '/' },
    { label: 'Salon dashboard', href: '/salon/dashboard' },
    { label: 'Support', href: '/salons' },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-[#f0dce5] bg-[#fff9fb]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d84b87] to-[#7f4fc7] text-lg font-bold text-white shadow-lg shadow-pink-200">
                G
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d84b87]">
                  GlowBook
                </p>
                <p className="text-sm font-bold text-[#2b1b25]">Beauty booking</p>
              </div>
            </div>

            <p className="mt-5 max-w-md text-sm leading-7 text-[#6d5863]">
              Discover premium salons, book beautiful experiences, and keep your
              beauty journey organised in one elegant platform.
            </p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">
                {title}
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-[#6d5863]">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="transition hover:text-[#2b1b25]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-[#f0dce5] pt-6 text-sm text-[#6d5863]">
          © 2026 GlowBook. Built for modern salon experiences.
        </div>
      </div>
    </footer>
  );
}

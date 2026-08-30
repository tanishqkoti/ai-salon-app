import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fff9fb] px-6 py-16 text-[#2b1b25]">
      <div className="w-full max-w-3xl rounded-[2rem] border border-[#f0dce5] bg-white p-8 text-center shadow-xl shadow-pink-100 sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">
          404 error
        </p>
        <h1 className="mt-5 text-5xl font-bold sm:text-6xl">Page not found</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-[#6d5863]">
          The page you were looking for has moved, expired, or never existed. Head back to GlowBook to continue exploring salons and booking beauty experiences.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/"
            className="rounded-full bg-[#d84b87] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-pink-200 transition hover:bg-[#bf356e]"
          >
            Back to home
          </Link>
          <Link
            href="/salons"
            className="rounded-full border border-[#d84b87] bg-white px-6 py-3.5 text-sm font-semibold text-[#d84b87] transition hover:bg-[#fff0f6]"
          >
            Explore salons
          </Link>
          <Link
            href="/salon/dashboard"
            className="rounded-full border border-[#e9d4df] bg-[#fffdfd] px-6 py-3.5 text-sm font-semibold text-[#2b1b25] transition hover:bg-[#fff0f6]"
          >
            Salon dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

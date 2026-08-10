import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <h1 className="text-4xl font-semibold text-stone-950">Page not found</h1>
      <p className="mt-3 text-stone-700">That StyleHub page is not available.</p>
      <Link href="/" className="mt-6 inline-flex rounded-[6px] bg-stone-950 px-5 py-3 text-sm font-bold text-white">
        Go home
      </Link>
    </main>
  );
}


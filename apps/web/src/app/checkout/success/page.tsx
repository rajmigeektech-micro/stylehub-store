import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <section className="surface rounded-[8px] p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--teal)]" />
        <h1 className="mt-4 text-3xl font-semibold text-stone-950">Payment received</h1>
        <p className="mt-3 text-stone-700">
          Stripe has accepted the checkout session. The webhook will mark the order paid and reduce inventory automatically.
        </p>
        {session_id && <p className="mt-4 font-mono text-xs text-stone-500">Session: {session_id}</p>}
        <Link href="/" className="mt-6 inline-flex rounded-[6px] bg-stone-950 px-5 py-3 text-sm font-bold text-white">
          Continue shopping
        </Link>
      </section>
    </main>
  );
}


import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getProducts } from "@/lib/api";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [categories, products] = await Promise.all([getCategories(), getProducts({ category: slug })]);
  const category = categories.find((candidate) => candidate.slug === slug);
  if (!category) notFound();

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/" className="text-sm font-bold text-stone-600 underline underline-offset-4">
            Home
          </Link>
          <h1 className="mt-3 text-4xl font-semibold text-stone-950">{category.name}</h1>
          <p className="mt-2 max-w-2xl text-stone-700">{category.description}</p>
        </div>
        <p className="text-sm font-semibold text-stone-600">{products.length} products</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </main>
  );
}


import type { Category, Product } from "./types";

const localApiBase = process.env.NODE_ENV === "production" ? "" : "http://localhost:4000";

export const publicApiBase = process.env.NEXT_PUBLIC_API_URL || localApiBase;
const serverApiBase = process.env.API_URL || publicApiBase;

function apiBase() {
  if (!serverApiBase) {
    throw new Error("API_URL or NEXT_PUBLIC_API_URL must be configured.");
  }
  return serverApiBase.replace(/\/$/, "");
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export async function getCategories() {
  const data = await fetchJson<{ categories: Category[] }>("/api/categories");
  return data.categories;
}

export async function getProducts(options: { category?: string; featured?: boolean } = {}) {
  const params = new URLSearchParams();
  if (options.category) params.set("category", options.category);
  if (options.featured) params.set("featured", "true");
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const data = await fetchJson<{ products: Product[] }>(`/api/products${suffix}`);
  return data.products;
}

export async function getProduct(slug: string) {
  const data = await fetchJson<{ product: Product }>(`/api/products/${slug}`);
  return data.product;
}


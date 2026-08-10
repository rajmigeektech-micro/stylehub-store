"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BarChart3, Boxes, ClipboardList, PackagePlus, ShieldCheck, Star, Users } from "lucide-react";
import { money, publicApiBase } from "@/lib/api";
import type { Category, Product } from "@/lib/types";

type Dashboard = {
  metrics: {
    revenue_cents: number;
    paid_orders: number;
    total_orders: number;
    customers: number;
    low_stock: number;
  };
  lowStock: Array<{ id: string; sku: string; size: string; color: string; stock: number; products: { name: string } }>;
  recentOrders: AdminOrder[];
};

type AdminOrder = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_cents: number;
  created_at: string;
  customers?: { name: string; email: string };
  order_items?: Array<{ product_name: string; size: string; color: string; quantity: number; line_total_cents: number }>;
};

type Customer = {
  id: string;
  name: string;
  email: string;
  orders?: Array<{ id: string; total_cents: number; payment_status: string }>;
};

type ReviewRow = {
  id: string;
  reviewer_name: string;
  rating: number;
  title: string;
  body: string;
  approved: boolean;
  products?: { name: string; slug: string };
};

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "products", label: "Products", icon: Boxes },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "customers", label: "Customers", icon: Users },
  { id: "reviews", label: "Reviews", icon: Star },
] as const;

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("admin@stylehub.test");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("dashboard");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setToken(window.localStorage.getItem("stylehub-admin-token") || "");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (token) void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [token]
  );

  async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${publicApiBase}${path}`, {
      ...init,
      headers: {
        ...authHeaders,
        ...(init?.headers || {}),
      },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Admin request failed.");
    return data as T;
  }

  async function loadAll() {
    setBusy(true);
    setMessage("");
    try {
      const [dashboardData, productsData, categoriesData, ordersData, customersData, reviewsData] = await Promise.all([
        adminFetch<{ metrics: Dashboard["metrics"]; lowStock: Dashboard["lowStock"]; recentOrders: AdminOrder[] }>("/api/admin/dashboard"),
        adminFetch<{ products: Product[] }>("/api/admin/products"),
        adminFetch<{ categories: Category[] }>("/api/admin/categories"),
        adminFetch<{ orders: AdminOrder[] }>("/api/admin/orders"),
        adminFetch<{ customers: Customer[] }>("/api/admin/customers"),
        adminFetch<{ reviews: ReviewRow[] }>("/api/admin/reviews"),
      ]);
      setDashboard(dashboardData);
      setProducts(productsData.products);
      setCategories(categoriesData.categories);
      setOrders(ordersData.orders);
      setCustomers(customersData.customers);
      setReviews(reviewsData.reviews);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load admin data.");
    } finally {
      setBusy(false);
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${publicApiBase}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login failed.");
      window.localStorage.setItem("stylehub-admin-token", data.token);
      setToken(data.token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function updateVariantStock(variantId: string, stock: number) {
    await adminFetch(`/api/admin/variants/${variantId}`, {
      method: "PATCH",
      body: JSON.stringify({ stock }),
    });
    setMessage("Inventory updated.");
    await loadAll();
  }

  async function createVariant(event: FormEvent<HTMLFormElement>, productId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    await adminFetch(`/api/admin/products/${productId}/variants`, {
      method: "POST",
      body: JSON.stringify({
        sku: String(formData.get("sku") || "") || undefined,
        size: String(formData.get("size")),
        color: String(formData.get("color")),
        stock: Number(formData.get("stock") || 0),
      }),
    });
    form.reset();
    setMessage("Variant added.");
    await loadAll();
  }

  async function createProductImage(event: FormEvent<HTMLFormElement>, productId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    await adminFetch(`/api/admin/products/${productId}/images`, {
      method: "POST",
      body: JSON.stringify({
        url: String(formData.get("url")),
        alt: String(formData.get("alt")),
        position: Number(formData.get("position") || 99),
      }),
    });
    form.reset();
    setMessage("Product image added.");
    await loadAll();
  }

  async function updateCategory(categoryId: string, payload: Partial<Category>) {
    await adminFetch(`/api/admin/categories/${categoryId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    setMessage("Category updated.");
    await loadAll();
  }

  async function updateOrderStatus(orderId: string, status: string) {
    await adminFetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setMessage("Order updated.");
    await loadAll();
  }

  async function toggleReview(reviewId: string, approved: boolean) {
    await adminFetch(`/api/admin/reviews/${reviewId}`, {
      method: "PATCH",
      body: JSON.stringify({ approved }),
    });
    setMessage("Review updated.");
    await loadAll();
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await adminFetch("/api/admin/categories", {
      method: "POST",
      body: JSON.stringify({
        name: String(form.get("name")),
        description: String(form.get("description") || ""),
        position: Number(form.get("position") || 99),
      }),
    });
    event.currentTarget.reset();
    setMessage("Category created.");
    await loadAll();
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await adminFetch("/api/admin/products", {
      method: "POST",
      body: JSON.stringify({
        name: String(form.get("name")),
        category_id: String(form.get("category_id")),
        price_cents: Math.round(Number(form.get("price")) * 100),
        short_description: String(form.get("short_description")),
        description: String(form.get("description")),
        featured: form.get("featured") === "on",
        active: true,
      }),
    });
    event.currentTarget.reset();
    setMessage("Product created.");
    await loadAll();
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6 lg:px-8">
        <section className="surface rounded-[8px] p-6">
          <ShieldCheck className="h-10 w-10 text-[var(--teal)]" />
          <h1 className="mt-4 text-3xl font-semibold text-stone-950">Admin</h1>
          <form className="mt-6 space-y-4" onSubmit={login}>
            <label className="block text-sm font-semibold text-stone-800">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="focus-ring mt-1 h-11 w-full rounded-[6px] border border-stone-200 px-3"
              />
            </label>
            <label className="block text-sm font-semibold text-stone-800">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="focus-ring mt-1 h-11 w-full rounded-[6px] border border-stone-200 px-3"
              />
            </label>
            {message && <p className="rounded-[6px] bg-red-50 p-3 text-sm text-red-700">{message}</p>}
            <button className="focus-ring btn-primary h-11 w-full rounded-[6px] text-sm font-bold" disabled={busy}>
              Sign in
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-[var(--teal)]">Operations</p>
          <h1 className="text-4xl font-semibold text-stone-950">Admin panel</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="focus-ring btn-secondary rounded-[6px] px-4 py-2 text-sm font-bold" onClick={loadAll} disabled={busy}>
            Refresh
          </button>
          <button
            className="focus-ring btn-secondary rounded-[6px] px-4 py-2 text-sm font-bold"
            onClick={() => {
              window.localStorage.removeItem("stylehub-admin-token");
              setToken("");
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {message && <p className="mt-4 rounded-[6px] border border-stone-200 bg-white p-3 text-sm font-semibold text-stone-800">{message}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="surface h-fit rounded-[8px] p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`focus-ring flex w-full items-center gap-3 rounded-[6px] px-3 py-2 text-left text-sm font-bold ${
                  activeTab === tab.id ? "bg-stone-950 text-white" : "text-stone-700 hover:bg-stone-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <section className="min-w-0">
          {activeTab === "dashboard" && dashboard && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <Metric label="Revenue" value={money(dashboard.metrics.revenue_cents)} />
                <Metric label="Paid orders" value={String(dashboard.metrics.paid_orders)} />
                <Metric label="Total orders" value={String(dashboard.metrics.total_orders)} />
                <Metric label="Customers" value={String(dashboard.metrics.customers)} />
                <Metric label="Low stock" value={String(dashboard.metrics.low_stock)} />
              </div>
              <Panel title="Low-stock alerts">
                <div className="overflow-auto">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Variant</th>
                        <th>Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.lowStock.map((variant) => (
                        <tr key={variant.id}>
                          <td>{variant.products?.name}</td>
                          <td>
                            {variant.size} / {variant.color}
                          </td>
                          <td className="font-semibold text-[var(--coral)]">{variant.stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          )}

          {activeTab === "products" && (
            <div className="space-y-5">
              <Panel title="Create category">
                <form className="grid gap-3 md:grid-cols-[1fr_1.5fr_120px_auto]" onSubmit={createCategory}>
                  <input name="name" placeholder="Category name" className="focus-ring h-11 rounded-[6px] border border-stone-200 px-3" required />
                  <input name="description" placeholder="Description" className="focus-ring h-11 rounded-[6px] border border-stone-200 px-3" />
                  <input name="position" type="number" placeholder="Position" className="focus-ring h-11 rounded-[6px] border border-stone-200 px-3" />
                  <button className="focus-ring btn-primary rounded-[6px] px-4 text-sm font-bold">Create</button>
                </form>
              </Panel>
              <Panel title="Categories">
                <div className="overflow-auto">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Position</th>
                        <th>Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((category) => (
                        <tr key={category.id}>
                          <td>
                            <input
                              defaultValue={category.name}
                              onBlur={(event) => event.target.value !== category.name && updateCategory(category.id, { name: event.target.value })}
                              className="focus-ring h-10 w-full rounded-[6px] border border-stone-200 px-2"
                            />
                          </td>
                          <td>
                            <input
                              defaultValue={category.description || ""}
                              onBlur={(event) =>
                                event.target.value !== (category.description || "") &&
                                updateCategory(category.id, { description: event.target.value })
                              }
                              className="focus-ring h-10 w-full min-w-64 rounded-[6px] border border-stone-200 px-2"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              defaultValue={category.position || 0}
                              onBlur={(event) => Number(event.target.value) !== (category.position || 0) && updateCategory(category.id, { position: Number(event.target.value) })}
                              className="focus-ring h-10 w-20 rounded-[6px] border border-stone-200 px-2"
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              defaultChecked={category.active !== false}
                              onChange={(event) => updateCategory(category.id, { active: event.target.checked })}
                              className="h-5 w-5 accent-[var(--teal)]"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <Panel title="Create product">
                <form className="grid gap-3" onSubmit={createProduct}>
                  <div className="grid gap-3 md:grid-cols-3">
                    <input name="name" placeholder="Product name" className="focus-ring h-11 rounded-[6px] border border-stone-200 px-3" required />
                    <select name="category_id" className="focus-ring h-11 rounded-[6px] border border-stone-200 px-3" required>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <input name="price" type="number" step="0.01" placeholder="Price" className="focus-ring h-11 rounded-[6px] border border-stone-200 px-3" required />
                  </div>
                  <input name="short_description" placeholder="Short description" className="focus-ring h-11 rounded-[6px] border border-stone-200 px-3" required />
                  <textarea name="description" placeholder="Description" className="focus-ring min-h-24 rounded-[6px] border border-stone-200 px-3 py-2" required />
                  <label className="inline-flex items-center gap-2 text-sm font-semibold">
                    <input name="featured" type="checkbox" />
                    Featured
                  </label>
                  <button className="focus-ring btn-primary h-11 rounded-[6px] px-4 text-sm font-bold">Create product</button>
                </form>
              </Panel>
              <Panel title="Products and inventory">
                <div className="overflow-auto">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Price</th>
                        <th>Flags</th>
                        <th>Variants</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id}>
                          <td>
                            <p className="font-semibold text-stone-950">{product.name}</p>
                            <p className="text-sm text-stone-500">{product.category.name}</p>
                          </td>
                          <td>{money(product.price_cents)}</td>
                          <td className="text-sm">
                            {product.featured ? "Featured" : "Standard"} / {product.active ? "Active" : "Hidden"}
                          </td>
                          <td>
                            <div className="grid gap-2">
                              {product.variants.map((variant) => (
                                <div key={variant.id} className="flex items-center gap-2">
                                  <span className="min-w-28 text-sm">
                                    {variant.size} / {variant.color}
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    defaultValue={variant.stock}
                                    className="focus-ring h-9 w-20 rounded-[6px] border border-stone-200 px-2"
                                    onBlur={(event) => updateVariantStock(variant.id, Number(event.target.value))}
                                  />
                                </div>
                              ))}
                              <form className="mt-2 grid gap-2 rounded-[6px] border border-stone-200 p-2" onSubmit={(event) => createVariant(event, product.id)}>
                                <p className="text-xs font-bold uppercase text-stone-500">Add variant</p>
                                <div className="grid gap-2 md:grid-cols-4">
                                  <input name="size" placeholder="Size" className="focus-ring h-9 rounded-[6px] border border-stone-200 px-2 text-sm" required />
                                  <input name="color" placeholder="Color" className="focus-ring h-9 rounded-[6px] border border-stone-200 px-2 text-sm" required />
                                  <input name="stock" type="number" min={0} placeholder="Stock" className="focus-ring h-9 rounded-[6px] border border-stone-200 px-2 text-sm" required />
                                  <input name="sku" placeholder="SKU optional" className="focus-ring h-9 rounded-[6px] border border-stone-200 px-2 text-sm" />
                                </div>
                                <button className="focus-ring btn-secondary h-9 rounded-[6px] px-3 text-xs font-bold">Add variant</button>
                              </form>
                              <form className="grid gap-2 rounded-[6px] border border-stone-200 p-2" onSubmit={(event) => createProductImage(event, product.id)}>
                                <p className="text-xs font-bold uppercase text-stone-500">Add image</p>
                                <input name="url" type="url" placeholder="Image URL" className="focus-ring h-9 rounded-[6px] border border-stone-200 px-2 text-sm" required />
                                <div className="grid gap-2 md:grid-cols-[1fr_90px]">
                                  <input name="alt" placeholder="Alt text" className="focus-ring h-9 rounded-[6px] border border-stone-200 px-2 text-sm" required />
                                  <input name="position" type="number" min={0} placeholder="Order" className="focus-ring h-9 rounded-[6px] border border-stone-200 px-2 text-sm" />
                                </div>
                                <button className="focus-ring btn-secondary h-9 rounded-[6px] px-3 text-xs font-bold">Add image</button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          )}

          {activeTab === "orders" && (
            <Panel title="Orders">
              <div className="overflow-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Payment</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="font-mono text-xs">{order.order_number}</td>
                        <td>
                          <p className="font-semibold">{order.customers?.name}</p>
                          <p className="text-sm text-stone-500">{order.customers?.email}</p>
                        </td>
                        <td>{order.payment_status}</td>
                        <td>{money(order.total_cents)}</td>
                        <td>
                          <select
                            defaultValue={order.status}
                            onChange={(event) => updateOrderStatus(order.id, event.target.value)}
                            className="focus-ring h-10 rounded-[6px] border border-stone-200 px-2"
                          >
                            {["pending", "processing", "paid", "fulfilled", "cancelled", "refunded"].map((status) => (
                              <option key={status}>{status}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {activeTab === "customers" && (
            <Panel title="Customers">
              <div className="overflow-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Orders</th>
                      <th>Lifetime value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => {
                      const paid = (customer.orders || []).filter((order) => order.payment_status === "paid");
                      return (
                        <tr key={customer.id}>
                          <td className="font-semibold">{customer.name}</td>
                          <td>{customer.email}</td>
                          <td>{customer.orders?.length || 0}</td>
                          <td>{money(paid.reduce((sum, order) => sum + order.total_cents, 0))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {activeTab === "reviews" && (
            <Panel title="Reviews">
              <div className="overflow-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Review</th>
                      <th>Rating</th>
                      <th>Approved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.map((review) => (
                      <tr key={review.id}>
                        <td>{review.products?.name}</td>
                        <td>
                          <p className="font-semibold">{review.title}</p>
                          <p className="text-sm text-stone-600">{review.body}</p>
                          <p className="mt-1 text-xs text-stone-500">{review.reviewer_name}</p>
                        </td>
                        <td>{review.rating}</td>
                        <td>
                          <input
                            type="checkbox"
                            checked={review.approved}
                            onChange={(event) => toggleReview(review.id, event.target.checked)}
                            className="h-5 w-5 accent-[var(--teal)]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface rounded-[8px] p-4">
      <p className="text-sm font-semibold text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-stone-950">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface rounded-[8px] bg-white">
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
        <h2 className="text-lg font-semibold text-stone-950">{title}</h2>
        <PackagePlus className="h-5 w-5 text-stone-400" />
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";

function envOrFallback(name, fallback) {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) throw new Error(`${name} must be configured in production.`);
  return fallback;
}

function normalizeOrigin(value) {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/$/, "");
  }
}

function splitOrigins(value) {
  return (value || "")
    .split(",")
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter(Boolean);
}

const config = {
  port: Number(process.env.PORT || 4000),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  frontendUrl: envOrFallback("FRONTEND_URL", "http://localhost:3000"),
  adminUrl: envOrFallback("ADMIN_URL", "http://localhost:3000/admin"),
  corsOrigins: splitOrigins(process.env.CORS_ORIGINS),
  allowVercelPreviewOrigins: process.env.ALLOW_VERCEL_PREVIEW_ORIGINS === "true",
  jwtSecret: envOrFallback("JWT_SECRET", "dev-stylehub-secret"),
  adminEmail: envOrFallback("ADMIN_EMAIL", "admin@stylehub.test"),
  adminPassword: envOrFallback("ADMIN_PASSWORD", "stylehub-admin"),
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
  slackBotToken: process.env.SLACK_BOT_TOKEN,
  slackOrderChannelId: process.env.SLACK_ORDER_CHANNEL_ID || "C0B9MMN4GTH",
  slackStatusChannelId: process.env.SLACK_STATUS_CHANNEL_ID || "C0B9MMN4GTH",
};

let supabaseClient;
let stripeClient;

function getSupabase() {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error("Supabase environment variables are not configured.");
  }
  if (!supabaseClient) {
    supabaseClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return supabaseClient;
}

function getStripe() {
  if (!config.stripeSecretKey) {
    throw new Error("Stripe secret key is not configured.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(config.stripeSecretKey, { apiVersion: "2026-02-25.clover" });
  }
  return stripeClient;
}

function cents(amount) {
  return Number(amount || 0);
}

function dollars(amount) {
  return `$${(cents(amount) / 100).toFixed(2)}`;
}

function normalizeProduct(product) {
  const reviews = (product.reviews || []).filter((review) => review.approved !== false);
  const rating =
    reviews.length === 0
      ? 0
      : Number((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1));

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    short_description: product.short_description,
    description: product.description,
    price_cents: product.price_cents,
    compare_at_cents: product.compare_at_cents,
    featured: product.featured,
    active: product.active,
    material: product.material,
    care: product.care,
    category: product.categories,
    images: (product.product_images || []).sort((a, b) => a.position - b.position),
    variants: (product.product_variants || []).sort((a, b) => `${a.color}-${a.size}`.localeCompare(`${b.color}-${b.size}`)),
    reviews,
    rating,
    review_count: reviews.length,
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const productSelect = `
  id, slug, name, short_description, description, price_cents, compare_at_cents, featured, active, material, care, created_at,
  categories(id, name, slug),
  product_images(id, url, alt, position),
  product_variants(id, sku, size, color, stock),
  reviews(id, reviewer_name, rating, title, body, approved, created_at)
`;

const app = express();

app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const stripe = getStripe();
    const signature = req.headers["stripe-signature"];
    if (!signature || !config.stripeWebhookSecret) {
      throw new Error("Missing Stripe webhook signature or secret.");
    }

    const event = stripe.webhooks.constructEvent(req.body, signature, config.stripeWebhookSecret);
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;
      if (session.payment_status !== "paid") {
        return res.json({ received: true, paymentPending: true });
      }
      const orderId = session.metadata?.order_id;
      if (!orderId) throw new Error("Stripe session missing order_id metadata.");

      const { data, error } = await getSupabase().rpc("mark_order_paid", {
        p_order_id: orderId,
        p_stripe_session_id: session.id,
        p_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
      });
      if (error) throw error;

      await notifyPaidOrder(data);
    }

    res.json({ received: true });
  } catch (error) {
    await notifyStatus(`Stripe webhook error: ${error.message}`);
    res.status(400).json({ error: error.message });
  }
});

const localOrigins = isProduction
  ? []
  : ["http://localhost:3000", "http://localhost:3100", "http://127.0.0.1:3000", "http://127.0.0.1:3100"];
const allowedOrigins = new Set(
  [config.frontendUrl, config.adminUrl, ...config.corsOrigins, ...localOrigins].map(normalizeOrigin).filter(Boolean)
);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin(origin, callback) {
      const normalizedOrigin = normalizeOrigin(origin);
      const isAllowedPreview =
        config.allowVercelPreviewOrigins && normalizedOrigin.endsWith(".vercel.app");
      if (!origin || allowedOrigins.has(normalizedOrigin) || isAllowedPreview) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing admin token." });

  try {
    req.admin = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: "Invalid admin token." });
  }
}

async function postSlackText(channelId, text) {
  if (config.slackBotToken) {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.slackBotToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: channelId, text }),
    });
    const result = await response.json();
    if (!result.ok) throw new Error(`Slack API error: ${result.error}`);
    return result;
  }

  if (config.slackWebhookUrl) {
    const response = await fetch(config.slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: channelId, text }),
    });
    if (!response.ok) throw new Error(`Slack webhook failed with ${response.status}.`);
    return { ok: true };
  }

  console.warn("Slack runtime credential missing; notification skipped.");
  return { ok: false, skipped: true };
}

async function notifyStatus(message) {
  try {
    await postSlackText(config.slackStatusChannelId, `StyleHub API alert\n${message}`);
  } catch (error) {
    console.error("Failed to send Slack status notification", error);
  }
}

async function notifyPaidOrder(orderSummary) {
  const items = (orderSummary?.items || [])
    .map(
      (item) =>
        `- ${item.quantity} x ${item.product_name} (${item.size}, ${item.color}, ${item.variant_sku}) - ${dollars(item.line_total_cents)}`
    )
    .join("\n");
  const message = [
    "*Paid StyleHub order received*",
    `Order ID: ${orderSummary.id}`,
    `Order number: ${orderSummary.order_number || "n/a"}`,
    `Customer: ${orderSummary.customer_name} <${orderSummary.customer_email}>`,
    `Payment status: ${orderSummary.payment_status}`,
    `Total: ${dollars(orderSummary.total_cents)}`,
    "Items:",
    items || "- No items",
  ].join("\n");

  await postSlackText(config.slackOrderChannelId, message);
}

app.get("/health", asyncHandler(async (req, res) => {
  const { count, error } = await getSupabase()
    .from("categories")
    .select("id", { count: "exact", head: true });
  if (error) throw error;

  res.json({
    ok: true,
    service: "stylehub-store-api",
    stripe: Boolean(config.stripeSecretKey),
    supabase: true,
    catalogCategories: count || 0,
  });
}));

app.get(
  "/api/categories",
  asyncHandler(async (req, res) => {
    const { data, error } = await getSupabase().from("categories").select("*").eq("active", true).order("position");
    if (error) throw error;
    res.json({ categories: data });
  })
);

app.get(
  "/api/products",
  asyncHandler(async (req, res) => {
    let query = getSupabase().from("products").select(productSelect).eq("active", true).order("created_at", { ascending: false });

    if (req.query.category) {
      const { data: category, error } = await getSupabase()
        .from("categories")
        .select("id")
        .eq("slug", String(req.query.category))
        .single();
      if (error) throw error;
      query = query.eq("category_id", category.id);
    }

    if (req.query.featured === "true") query = query.eq("featured", true);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ products: data.map(normalizeProduct) });
  })
);

app.get(
  "/api/products/:slug",
  asyncHandler(async (req, res) => {
    const { data, error } = await getSupabase()
      .from("products")
      .select(productSelect)
      .eq("slug", req.params.slug)
      .eq("active", true)
      .single();
    if (error) throw error;
    res.json({ product: normalizeProduct(data) });
  })
);

app.get(
  "/api/orders/by-session/:sessionId",
  asyncHandler(async (req, res) => {
    const { data, error } = await getSupabase()
      .from("orders")
      .select("id, order_number, payment_status, total_cents, stripe_session_id")
      .eq("stripe_session_id", req.params.sessionId)
      .maybeSingle();
    if (error) throw error;
    res.json({ order: data });
  })
);

const checkoutSchema = z.object({
  customer: z.object({
    name: z.string().min(2),
    email: z.string().email(),
  }),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).max(10),
      })
    )
    .min(1),
});

app.post(
  "/api/checkout/sessions",
  asyncHandler(async (req, res) => {
    const body = checkoutSchema.parse(req.body);
    const variantIds = body.items.map((item) => item.variantId);

    const { data: variants, error: variantsError } = await getSupabase()
      .from("product_variants")
      .select("id, sku, size, color, stock, products(id, name, slug, price_cents, product_images(url, position))")
      .in("id", variantIds);
    if (variantsError) throw variantsError;

    const variantById = new Map(variants.map((variant) => [variant.id, variant]));
    const orderItems = body.items.map((item) => {
      const variant = variantById.get(item.variantId);
      if (!variant) throw new Error(`Variant ${item.variantId} was not found.`);
      if (variant.stock < item.quantity) {
        throw new Error(`${variant.products.name} (${variant.size}, ${variant.color}) only has ${variant.stock} in stock.`);
      }
      const image = [...(variant.products.product_images || [])].sort((a, b) => a.position - b.position)[0]?.url;
      return {
        product_id: variant.products.id,
        variant_id: variant.id,
        product_name: variant.products.name,
        product_slug: variant.products.slug,
        variant_sku: variant.sku,
        size: variant.size,
        color: variant.color,
        image_url: image,
        quantity: item.quantity,
        unit_price_cents: variant.products.price_cents,
        line_total_cents: variant.products.price_cents * item.quantity,
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.line_total_cents, 0);
    const shipping = subtotal >= 12500 ? 0 : 895;
    const tax = Math.round(subtotal * 0.0825);
    const total = subtotal + shipping + tax;

    const { data: customer, error: customerError } = await getSupabase()
      .from("customers")
      .upsert({ email: body.customer.email, name: body.customer.name }, { onConflict: "email" })
      .select()
      .single();
    if (customerError) throw customerError;

    const { data: order, error: orderError } = await getSupabase()
      .from("orders")
      .insert({
        customer_id: customer.id,
        status: "pending",
        payment_status: "unpaid",
        subtotal_cents: subtotal,
        shipping_cents: shipping,
        tax_cents: tax,
        total_cents: total,
      })
      .select()
      .single();
    if (orderError) throw orderError;

    const { error: itemsError } = await getSupabase()
      .from("order_items")
      .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));
    if (itemsError) throw itemsError;

    const stripeSession = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: customer.email,
      line_items: [
        ...orderItems.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: "usd",
            unit_amount: item.unit_price_cents,
            product_data: {
              name: item.product_name,
              description: `${item.size} / ${item.color}`,
              images: item.image_url ? [item.image_url] : undefined,
            },
          },
        })),
        ...(shipping
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: shipping,
                  product_data: { name: "Shipping" },
                },
              },
            ]
          : []),
        ...(tax
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: tax,
                  product_data: { name: "Estimated tax" },
                },
              },
            ]
          : []),
      ],
      success_url: `${config.frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.frontendUrl}/cart?checkout=cancelled`,
      metadata: { order_id: order.id },
    });

    const { error: updateError } = await getSupabase()
      .from("orders")
      .update({ stripe_session_id: stripeSession.id })
      .eq("id", order.id);
    if (updateError) throw updateError;

    res.json({ url: stripeSession.url, sessionId: stripeSession.id, orderId: order.id });
  })
);

app.post(
  "/api/admin/login",
  asyncHandler(async (req, res) => {
    const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const emailOk = email.toLowerCase() === config.adminEmail.toLowerCase();
    const passwordOk = config.adminPassword.startsWith("$2")
      ? await bcrypt.compare(password, config.adminPassword)
      : password === config.adminPassword;
    if (!emailOk || !passwordOk) return res.status(401).json({ error: "Invalid admin credentials." });

    const token = jwt.sign({ email, role: "admin" }, config.jwtSecret, { expiresIn: "8h" });
    res.json({ token });
  })
);

app.get(
  "/api/admin/dashboard",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [{ data: orders, error: ordersError }, { data: variants, error: variantsError }, { data: customers, error: customersError }] =
      await Promise.all([
        getSupabase().from("orders").select("id, order_number, status, payment_status, total_cents, created_at, customers(name, email)").order("created_at", { ascending: false }),
        getSupabase().from("product_variants").select("id, sku, size, color, stock, products(name, slug)").lte("stock", 5).order("stock"),
        getSupabase().from("customers").select("id", { count: "exact", head: false }),
      ]);
    if (ordersError) throw ordersError;
    if (variantsError) throw variantsError;
    if (customersError) throw customersError;

    const paidOrders = orders.filter((order) => order.payment_status === "paid");
    res.json({
      metrics: {
        revenue_cents: paidOrders.reduce((sum, order) => sum + order.total_cents, 0),
        paid_orders: paidOrders.length,
        total_orders: orders.length,
        customers: customers.length,
        low_stock: variants.length,
      },
      lowStock: variants,
      recentOrders: orders.slice(0, 10),
    });
  })
);

app.get(
  "/api/admin/products",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { data, error } = await getSupabase().from("products").select(productSelect).order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ products: data.map(normalizeProduct) });
  })
);

app.post(
  "/api/admin/products",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = z
      .object({
        name: z.string().min(2),
        category_id: z.string().uuid(),
        price_cents: z.number().int().min(100),
        description: z.string().min(10),
        short_description: z.string().min(5),
        featured: z.boolean().default(false),
        active: z.boolean().default(true),
      })
      .parse(req.body);

    const { data, error } = await getSupabase()
      .from("products")
      .insert({ ...payload, slug: slugify(payload.name) })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ product: data });
  })
);

app.patch(
  "/api/admin/products/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = z
      .object({
        name: z.string().min(2).optional(),
        price_cents: z.number().int().min(100).optional(),
        description: z.string().min(10).optional(),
        short_description: z.string().min(5).optional(),
        featured: z.boolean().optional(),
        active: z.boolean().optional(),
      })
      .parse(req.body);
    const { data, error } = await getSupabase().from("products").update(payload).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ product: data });
  })
);

app.post(
  "/api/admin/products/:id/images",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = z
      .object({
        url: z.string().url(),
        alt: z.string().min(2),
        position: z.number().int().min(0).default(99),
      })
      .parse(req.body);
    const { data, error } = await getSupabase()
      .from("product_images")
      .insert({ ...payload, product_id: req.params.id })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ image: data });
  })
);

app.post(
  "/api/admin/products/:id/variants",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = z
      .object({
        sku: z.string().min(3).optional(),
        size: z.string().min(1),
        color: z.string().min(2),
        stock: z.number().int().min(0).default(0),
      })
      .parse(req.body);

    const { data: product, error: productError } = await getSupabase()
      .from("products")
      .select("slug")
      .eq("id", req.params.id)
      .single();
    if (productError) throw productError;

    const sku =
      payload.sku ||
      `SH-${slugify(product.slug).slice(0, 12).toUpperCase()}-${slugify(payload.size).toUpperCase()}-${slugify(payload.color)
        .slice(0, 8)
        .toUpperCase()}`;

    const { data, error } = await getSupabase()
      .from("product_variants")
      .insert({ product_id: req.params.id, sku, size: payload.size, color: payload.color, stock: payload.stock })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ variant: data });
  })
);

app.get(
  "/api/admin/categories",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { data, error } = await getSupabase().from("categories").select("*").order("position");
    if (error) throw error;
    res.json({ categories: data });
  })
);

app.post(
  "/api/admin/categories",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = z
      .object({
        name: z.string().min(2),
        description: z.string().optional(),
        position: z.number().int().default(99),
      })
      .parse(req.body);
    const { data, error } = await getSupabase()
      .from("categories")
      .insert({ ...payload, slug: slugify(payload.name), active: true })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ category: data });
  })
);

app.patch(
  "/api/admin/categories/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = z
      .object({
        name: z.string().min(2).optional(),
        description: z.string().optional(),
        position: z.number().int().optional(),
        active: z.boolean().optional(),
      })
      .parse(req.body);
    const update = payload.name ? { ...payload, slug: slugify(payload.name) } : payload;
    const { data, error } = await getSupabase()
      .from("categories")
      .update(update)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ category: data });
  })
);

app.get(
  "/api/admin/orders",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { data, error } = await getSupabase()
      .from("orders")
      .select("*, customers(id, name, email), order_items(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ orders: data });
  })
);

app.patch(
  "/api/admin/orders/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = z.object({ status: z.enum(["pending", "processing", "paid", "fulfilled", "cancelled", "refunded"]).optional() }).parse(req.body);
    const { data, error } = await getSupabase().from("orders").update(payload).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ order: data });
  })
);

app.get(
  "/api/admin/customers",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { data, error } = await getSupabase().from("customers").select("*, orders(id, total_cents, payment_status)").order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ customers: data });
  })
);

app.get(
  "/api/admin/reviews",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { data, error } = await getSupabase().from("reviews").select("*, products(name, slug)").order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ reviews: data });
  })
);

app.patch(
  "/api/admin/reviews/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = z.object({ approved: z.boolean() }).parse(req.body);
    const { data, error } = await getSupabase().from("reviews").update(payload).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ review: data });
  })
);

app.patch(
  "/api/admin/variants/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = z.object({ stock: z.number().int().min(0) }).parse(req.body);
    const { data, error } = await getSupabase().from("product_variants").update(payload).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ variant: data });
  })
);

app.use(async (error, req, res, next) => {
  const status = error.status || (error.name === "ZodError" ? 422 : 500);
  const message = error.name === "ZodError" ? error.issues : error.message;
  if (status >= 500) await notifyStatus(`${req.method} ${req.path} failed: ${error.message}`);
  res.status(status).json({ error: message });
});

if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`StyleHub API listening on ${config.port}`);
  });
}

export default app;


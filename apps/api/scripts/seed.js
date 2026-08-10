import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const categoryConfig = [
  {
    name: "Men",
    slug: "men",
    description: "Tailored staples, relaxed layers, and everyday essentials.",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Navy", "Sage", "Black"],
    names: [
      "Mercer Oxford Shirt",
      "Soho Knit Polo",
      "Hudson Chino Trouser",
      "Atlas Utility Jacket",
      "Bleecker Crew Tee",
      "Camden Denim Shirt",
      "Ridge Performance Hoodie",
      "Lennox Linen Blazer",
      "Harbor Swim Short",
      "Monroe Merino Sweater",
      "Bowery Cargo Pant",
      "Archer Quilted Vest",
      "Summit Trail Overshirt",
      "Fulton Relaxed Jean",
      "Warren Poplin Shirt",
      "Crosby Bomber Jacket",
      "Keaton Drawstring Pant",
      "Alder Ribbed Henley",
    ],
  },
  {
    name: "Women",
    slug: "women",
    description: "Polished dresses, soft knits, and elevated everyday pieces.",
    sizes: ["XS", "S", "M", "L"],
    colors: ["Ivory", "Clay", "Midnight"],
    names: [
      "Avery Satin Slip Dress",
      "Marlow Wide-Leg Trouser",
      "Eden Ribbed Tank",
      "Florence Wrap Blouse",
      "Willow Utility Jumpsuit",
      "Camille Knit Cardigan",
      "Sienna Midi Skirt",
      "Noelle Tailored Blazer",
      "Rhea Linen Short",
      "Celeste Poplin Dress",
      "Juniper Cropped Jean",
      "Luna Cashmere Crew",
      "Valen Vegan Leather Jacket",
      "Mira Pleated Pant",
      "Opal Square-Neck Top",
      "Tessa Trench Coat",
      "Iris Soft Cargo Skirt",
      "Nora Relaxed Shirt",
    ],
  },
  {
    name: "Kids",
    slug: "kids",
    description: "Durable, playful, and parent-approved outfits for every day.",
    sizes: ["2T", "4T", "6", "8"],
    colors: ["Sky", "Berry", "Forest"],
    names: [
      "Mini Explorer Hoodie",
      "Playground Denim Overall",
      "Sunny Stripe Tee",
      "Adventure Cargo Jogger",
      "Storybook Cotton Dress",
      "Rainy Day Shell Jacket",
      "Little Scout Flannel",
      "Pocket Pal Sweatpant",
      "Seaside Rashguard Set",
      "Campfire Fleece Pullover",
      "Hopscotch Twill Short",
      "Rocket Graphic Tee",
      "Puddle Jumper Raincoat",
      "Kindergarten Knit Cardigan",
      "Weekend Corduroy Pant",
      "Tiny Trail Puffer Vest",
      "Garden Party Skort",
      "Recess Rugby Shirt",
    ],
  },
];

const imagePool = [
  "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=900&q=80",
];

const reviewTitles = [
  "Instant favorite",
  "Great fabric",
  "Easy to style",
  "Worth the price",
  "Better than expected",
  "Polished and comfortable",
  "Runs true to size",
  "Packed beautifully",
];

const reviewBodies = [
  "The fit feels considered and the material has a nice weight without being stiff.",
  "I wore this twice in one week. It looks sharp and still feels relaxed.",
  "The color is richer in person and it pairs well with basics I already own.",
  "Washed well, kept its shape, and feels like it will hold up through the season.",
  "The details are subtle but make it feel more expensive than the price.",
  "Comfortable for a full day and still presentable enough for dinner afterward.",
  "Exactly the kind of versatile piece I wanted for travel and weekends.",
  "Soft texture, clean finish, and the sizing guide was accurate for me.",
];

const reviewers = [
  "Morgan Lee",
  "Taylor Reed",
  "Avery Brooks",
  "Jordan Ellis",
  "Casey Nguyen",
  "Riley Parker",
  "Drew Singh",
  "Jamie Rivera",
  "Quinn Patel",
  "Alex Morgan",
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function priceFor(index, categorySlug) {
  const base = categorySlug === "kids" ? 2400 : categorySlug === "women" ? 5800 : 5200;
  return base + ((index % 6) * 700) + (index % 2 === 0 ? 0 : 500);
}

async function resetTables() {
  for (const table of ["order_items", "orders", "reviews", "product_variants", "product_images", "products", "customers", "categories"]) {
    const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw error;
  }
}

async function insertAndReturn(table, payload) {
  const { data, error } = await supabase.from(table).insert(payload).select();
  if (error) throw error;
  return data;
}

async function seed() {
  await resetTables();

  const categories = await insertAndReturn(
    "categories",
    categoryConfig.map((category, index) => ({
      name: category.name,
      slug: category.slug,
      description: category.description,
      position: index + 1,
      active: true,
    }))
  );

  const categoriesBySlug = new Map(categories.map((category) => [category.slug, category]));
  const allProducts = [];
  const allVariants = [];

  for (const category of categoryConfig) {
    for (let index = 0; index < category.names.length; index += 1) {
      const name = category.names[index];
      const price = priceFor(index, category.slug);
      const [product] = await insertAndReturn("products", [
        {
          category_id: categoriesBySlug.get(category.slug).id,
          name,
          slug: slugify(name),
          short_description: `${category.name} ${name.toLowerCase()} with clean lines and everyday comfort.`,
          description: `${name} is designed for repeat wear with a balanced fit, durable construction, and a refined finish. Pair it with denim, tailoring, or soft layers depending on the day.`,
          material: category.slug === "kids" ? "Soft cotton blend with reinforced seams" : "Premium cotton blend with recycled fibers",
          care: "Machine wash cold, tumble dry low, warm iron if needed.",
          price_cents: price,
          compare_at_cents: index % 4 === 0 ? price + 1800 : null,
          featured: index < 6,
          active: true,
        },
      ]);
      allProducts.push(product);

      const imageA = imagePool[(index + (category.slug === "women" ? 4 : category.slug === "kids" ? 8 : 0)) % imagePool.length];
      const imageB = imagePool[(index + 1 + (category.slug === "women" ? 4 : category.slug === "kids" ? 8 : 0)) % imagePool.length];
      await insertAndReturn("product_images", [
        { product_id: product.id, url: imageA, alt: `${name} front view`, position: 1 },
        { product_id: product.id, url: imageB, alt: `${name} detail view`, position: 2 },
      ]);

      const variants = [];
      for (const size of category.sizes) {
        for (const color of category.colors) {
          variants.push({
            product_id: product.id,
            sku: `${category.slug.slice(0, 1).toUpperCase()}-${slugify(name).slice(0, 10).toUpperCase()}-${size}-${color.slice(0, 3).toUpperCase()}`.replace(/[^A-Z0-9-]/g, ""),
            size,
            color,
            stock: 3 + ((index + size.length + color.length) % 15),
          });
        }
      }
      allVariants.push(...(await insertAndReturn("product_variants", variants)));

      const reviewCount = 4 + (index % 5);
      const reviews = Array.from({ length: reviewCount }, (_, reviewIndex) => ({
        product_id: product.id,
        reviewer_name: reviewers[(index + reviewIndex) % reviewers.length],
        rating: reviewIndex % 6 === 0 ? 4 : 5,
        title: reviewTitles[(index + reviewIndex) % reviewTitles.length],
        body: reviewBodies[(index + reviewIndex) % reviewBodies.length],
        approved: true,
      }));
      await insertAndReturn("reviews", reviews);
    }
  }

  const customers = await insertAndReturn("customers", [
    { name: "Priya Shah", email: "priya.shah@example.com" },
    { name: "Marcus Green", email: "marcus.green@example.com" },
    { name: "Elena Torres", email: "elena.torres@example.com" },
    { name: "Noah Williams", email: "noah.williams@example.com" },
    { name: "Maya Chen", email: "maya.chen@example.com" },
  ]);

  const orderStatuses = [
    ["paid", "paid"],
    ["processing", "paid"],
    ["pending", "unpaid"],
    ["cancelled", "failed"],
    ["refunded", "refunded"],
  ];

  for (let orderIndex = 0; orderIndex < 5; orderIndex += 1) {
    const chosenVariants = [allVariants[orderIndex * 8], allVariants[orderIndex * 8 + 4]].filter(Boolean);
    const orderLines = chosenVariants.map((variant, lineIndex) => {
      const product = allProducts.find((candidate) => candidate.id === variant.product_id);
      const quantity = lineIndex + 1;
      return {
        product,
        variant,
        quantity,
        line_total_cents: product.price_cents * quantity,
      };
    });
    const subtotal = orderLines.reduce((sum, line) => sum + line.line_total_cents, 0);
    const shipping = subtotal >= 12500 ? 0 : 895;
    const tax = Math.round(subtotal * 0.0825);
    const [status, payment_status] = orderStatuses[orderIndex];

    const [order] = await insertAndReturn("orders", [
      {
        customer_id: customers[orderIndex].id,
        status,
        payment_status,
        subtotal_cents: subtotal,
        shipping_cents: shipping,
        tax_cents: tax,
        total_cents: subtotal + shipping + tax,
        stripe_session_id: `seed_session_${orderIndex + 1}`,
        stripe_payment_intent: payment_status === "paid" ? `seed_pi_${orderIndex + 1}` : null,
        paid_at: payment_status === "paid" ? new Date().toISOString() : null,
      },
    ]);

    await insertAndReturn(
      "order_items",
      orderLines.map((line) => ({
        order_id: order.id,
        product_id: line.product.id,
        variant_id: line.variant.id,
        product_name: line.product.name,
        product_slug: line.product.slug,
        variant_sku: line.variant.sku,
        size: line.variant.size,
        color: line.variant.color,
        image_url: imagePool[0],
        quantity: line.quantity,
        unit_price_cents: line.product.price_cents,
        line_total_cents: line.line_total_cents,
      }))
    );
  }

  console.log(`Seeded ${allProducts.length} products, ${allVariants.length} variants, and 5 sample orders.`);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});


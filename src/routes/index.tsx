import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HomeLoadingSkeleton } from "@/components/LoadingSkeletons";
import { ProductCard } from "@/components/ProductCard";
import { categories, discountPct, formatINR, type Product } from "@/lib/catalog";
import { useProducts } from "@/lib/products-db";
import {
  ArrowRight,
  ArrowUpRight,
  Flame,
  ShieldCheck,
  Truck,
  RotateCcw,
  Cpu,
  HardDrive,
  Battery,
  Monitor,
  Zap,
  Sparkles,
  Star,
  CircuitBoard,
  Wifi,
  Plug,
  PackageOpen,
  Hand,
  GitFork,
  Volume2,
  HardDriveDownload,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "lapkart — Genuine laptop components, delivered fast" },
      {
        name: "description",
        content:
          "India's marketplace for laptop spare parts. RAM, SSDs, batteries, displays, motherboards, chargers — tested, certified, fast delivery.",
      },
      { property: "og:title", content: "lapkart — laptop parts marketplace" },
    ],
  }),
  component: Home,
});

// ── Helpers ────────────────────────────────────────────────────────────────
const byDiscount = (a: Product, b: Product) => discountPct(b) - discountPct(a);
const byRating = (a: Product, b: Product) => b.rating - a.rating;

function Home() {
  const { data: products = [], isLoading } = useProducts();

  const deals = [...products].sort(byDiscount).slice(0, 4);
  const editorsPicks = [...products].sort(byRating).slice(0, 6);
  const trending = products.slice(0, 6);
  const heroPicks = [
    products.find((p) => p.category === "displays") ?? products[0],
    products.find((p) => p.category === "batteries") ?? products[1],
    products.find((p) => p.category === "cooling") ?? products[2],
  ].filter(Boolean) as Product[];
  const pick = (cats: string[], n: number) =>
    products.filter((p) => cats.includes(p.category)).slice(0, n);
  const memory = pick(["ram", "ssd", "motherboards"], 2);
  const power = pick(["batteries", "chargers"], 2);
  const compute = pick(["processors", "cooling"], 2);

  return (
    <div className="min-h-screen bg-[var(--background-base)] text-foreground">
      <Header />

      {isLoading && products.length === 0 ? (
        <HomeLoadingSkeleton />
      ) : (
        <>
          <Hero picks={heroPicks} />
          <Marquee />
          <CategoryStrip products={products} />
          {deals.length > 0 && <HotDeals items={deals} />}
          {memory.length + power.length + compute.length > 0 && (
            <BuildYourLaptop memory={memory} power={power} compute={compute} />
          )}
          {editorsPicks.length > 0 && <EditorsPicks items={editorsPicks} />}
          <SpecBanner />
          {trending.length > 0 && <Trending items={trending} />}
          <BrandStrip />
          <Newsletter />
        </>
      )}

      <Footer />
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   HERO — editorial split with floating product stack
   ═════════════════════════════════════════════════════════════════════════ */
function Hero({ picks }: { picks: Product[] }) {
  return (
    <section className="relative overflow-hidden bg-[var(--accent-black)] text-white grain">
      {/* glow + grid */}
      <div className="pointer-events-none absolute -top-40 -left-32 h-[500px] w-[500px] rounded-full bg-[var(--heat-100)] opacity-25 blur-[160px]" />
      <div className="pointer-events-none absolute top-1/3 right-0 h-[360px] w-[360px] rounded-full bg-[var(--heat-200)] opacity-12 blur-[140px]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      <div className="relative container mx-auto px-4 pt-20 pb-28 md:pt-28 md:pb-36">
        <div className="grid items-center gap-16 lg:grid-cols-[1.15fr_1fr]">
          {/* ──── Left: editorial copy ──── */}
          <div>
            <div className="flex items-center gap-3 text-mono-x-small uppercase tracking-[0.24em] text-white/45 animate-fade-up">
              <span className="size-1.5 rounded-full bg-[var(--heat-100)] animate-pulse" />
              india · component marketplace · est. 2024
            </div>

            <h1 className="mt-7 font-display text-[58px] md:text-[80px] leading-[0.95] tracking-[-0.035em] font-medium text-white animate-fade-up delay-100 text-balance">
              Real parts.<br />
              <span className="text-gradient-heat">Real fast.</span><br />
              <span className="text-white/45">No fakes.</span>
            </h1>

            <p className="mt-8 max-w-md text-body-large text-white/65 leading-relaxed animate-fade-up delay-200">
              10,000+ tested laptop components — sourced from authorized
              distributors, shipped within 48 hours, backed by warranty.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 animate-fade-up delay-300">
              <Link
                to="/products"
                className="button button-primary inline-flex items-center gap-2 rounded-md px-7 h-12 text-label-medium text-white"
              >
                <Flame className="size-4" strokeWidth={2.4} />
                Shop all parts
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/products"
                search={{ category: "ssd" }}
                className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-6 h-12 text-label-medium text-white backdrop-blur hover:bg-white/[0.08] hover:border-white/30 transition-all"
              >
                Today's deals
                <ArrowUpRight className="size-4" />
              </Link>
            </div>

            <div className="mt-12 grid grid-cols-3 gap-8 max-w-md border-t border-white/10 pt-8 animate-fade-up delay-400">
              {[
                ["10K+", "parts in stock"],
                ["48h", "delivery"],
                ["4.6★", "rating"],
              ].map(([v, l]) => (
                <div key={l}>
                  <p className="font-display text-[32px] leading-none font-medium text-white">{v}</p>
                  <p className="mt-2 text-mono-x-small uppercase tracking-[0.18em] text-white/45">{l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ──── Right: stacked product cards ──── */}
          <div className="relative h-[460px] md:h-[540px] animate-fade-up delay-200">
            {picks.map((p, i) => (
              <HeroProductCard key={p.id} p={p} index={i} />
            ))}
            {/* Decorative ticks */}
            <div className="pointer-events-none absolute bottom-0 right-0 flex items-center gap-2 text-mono-x-small uppercase tracking-[0.22em] text-white/35">
              <span className="size-1 rounded-full bg-[var(--accent-forest)] animate-pulse" />
              all in stock
            </div>
          </div>
        </div>
      </div>

      {/* bottom edge fade */}
      <div className="pointer-events-none absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[var(--background-base)] to-transparent" />
    </section>
  );
}

function HeroProductCard({ p, index }: { p: Product; index: number }) {
  const positions = [
    "top-0 right-0 rotate-[3deg]",
    "top-[110px] right-[60px] -rotate-[2deg]",
    "top-[230px] right-[10px] rotate-[1.5deg]",
  ];
  return (
    <Link
      to="/product/$id"
      params={{ id: p.id }}
      style={{ animationDelay: `${300 + index * 120}ms`, zIndex: 3 - index }}
      className={`group absolute ${positions[index]} w-[280px] md:w-[320px] rounded-xl border border-white/10 bg-white/95 backdrop-blur-sm overflow-hidden shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)] hover:scale-[1.03] hover:rotate-0 hover:z-10 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] animate-fade-up`}
    >
      <div className="relative aspect-[16/10] bg-white overflow-hidden">
        <img src={(p.images?.[0]) ?? p.image} alt={p.title} className="size-full object-contain p-6" />
        <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-sm bg-[var(--heat-100)] px-2 py-0.5 text-mono-x-small font-medium text-white tracking-wide shadow-[0_2px_8px_0_var(--heat-40)]">
          −{discountPct(p)}%
        </span>
      </div>
      <div className="bg-white p-4">
        <p className="text-mono-x-small uppercase tracking-[0.16em] text-[var(--black-alpha-48)]">{p.brand}</p>
        <p className="mt-1 line-clamp-1 text-label-small text-foreground">{p.title}</p>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-label-medium font-medium text-foreground">{formatINR(p.price)}</span>
          <span className="inline-flex items-center gap-0.5 text-mono-small text-foreground">
            <Star className="size-3 fill-[var(--accent-honey)] text-[var(--accent-honey)]" />
            {p.rating.toFixed(1)}
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   MARQUEE — live ticker
   ═════════════════════════════════════════════════════════════════════════ */
function Marquee() {
  const ticks = [
    { ico: ShieldCheck, t: "100% genuine · brand-certified" },
    { ico: Truck, t: "free delivery on ₹999+" },
    { ico: RotateCcw, t: "7-day no-questions returns" },
    { ico: Zap, t: "48h shipping across india" },
    { ico: Sparkles, t: "10,000+ tested components" },
    { ico: Flame, t: "new deals every monday" },
  ];
  const loop = [...ticks, ...ticks, ...ticks];

  return (
    <section className="relative overflow-hidden border-y border-[var(--border-faint)] bg-white py-3.5">
      <div className="flex gap-12 whitespace-nowrap animate-[marquee_38s_linear_infinite]">
        {loop.map(({ ico: Ico, t }, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-64)]"
          >
            <Ico className="size-3.5 text-[var(--heat-100)]" strokeWidth={2.2} />
            {t}
            <span className="ml-12 size-1 rounded-full bg-[var(--heat-100)]" />
          </span>
        ))}
      </div>
      {/* edge fades */}
      <div className="pointer-events-none absolute left-0 inset-y-0 w-32 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute right-0 inset-y-0 w-32 bg-gradient-to-l from-white to-transparent" />

      <style>{`@keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-33.333%); } }`}</style>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   CATEGORY STRIP
   ═════════════════════════════════════════════════════════════════════════ */
function CategoryStrip({ products }: { products: Product[] }) {
  const iconMap: Record<string, typeof HardDrive> = {
    ram: HardDrive,
    ssd: HardDrive,
    motherboards: CircuitBoard,
    batteries: Battery,
    displays: Monitor,
    keyboards: Cpu,
    processors: Cpu,
    cooling: Zap,
    chargers: Plug,
    wifi_cards: Wifi,
    dc_jacks: Plug,
    bottom_cases: PackageOpen,
    palmrests: Hand,
    hinges: GitFork,
    speakers: Volume2,
    hdd_boards: HardDriveDownload,
  };
  return (
    <section className="container mx-auto px-4 pt-20">
      <div className="flex items-end justify-between mb-8 gap-6 flex-wrap">
        <div>
          <span className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-100)]">01 / catalog</span>
          <h2 className="mt-2 font-display text-title-h3 text-foreground">Shop by category</h2>
        </div>
        <Link to="/products" className="group inline-flex items-center gap-1.5 text-label-small text-foreground hover:text-[var(--heat-100)] transition-colors">
          View all <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {categories.map((c, i) => {
          const Icon = iconMap[c.slug] || HardDrive;
          const count = products.filter((p) => p.category === c.slug).length;
          return (
            <Link
              key={c.slug}
              to="/products"
              search={{ category: c.slug }}
              style={{ animationDelay: `${i * 35}ms` }}
              className="group relative flex flex-col items-start justify-between gap-3 rounded-lg border border-[var(--border-faint)] bg-white p-4 h-[140px] overflow-hidden hover:border-[var(--heat-20)] hover:-translate-y-1 hover:shadow-[0_12px_24px_-12px_var(--heat-20)] transition-all duration-300 animate-fade-up"
            >
              <Icon className="size-5 text-[var(--black-alpha-40)] group-hover:text-[var(--heat-100)] transition-colors" strokeWidth={1.8} />
              <div>
                <p className="text-label-small text-foreground leading-tight">{c.name}</p>
                <p className="mt-0.5 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-40)]">
                  {count} {count === 1 ? "sku" : "skus"}
                </p>
              </div>
              <div className="pointer-events-none absolute -top-6 -right-6 size-20 rounded-full bg-[var(--heat-100)] opacity-0 group-hover:opacity-[0.08] blur-2xl transition-opacity duration-500" />
              <ArrowUpRight className="absolute top-3 right-3 size-3 text-[var(--black-alpha-24)] group-hover:text-[var(--heat-100)] transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   HOT DEALS — 4 big-discount cards
   ═════════════════════════════════════════════════════════════════════════ */
function HotDeals({ items }: { items: Product[] }) {
  return (
    <section className="container mx-auto px-4 pt-24">
      <div className="flex items-end justify-between mb-8 gap-6 flex-wrap">
        <div>
          <span className="inline-flex items-center gap-2 text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-100)]">
            <Flame className="size-3" strokeWidth={2.6} /> 02 / hot deals
          </span>
          <h2 className="mt-2 font-display text-title-h3 text-foreground">Steepest discounts this week</h2>
          <p className="mt-1 text-body-medium text-[var(--black-alpha-56)]">Refreshed every Monday. Stock is limited.</p>
        </div>
        <span className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--accent-forest)]">
          ● live · {items.length} drops
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((p, i) => (
          <Link
            key={p.id}
            to="/product/$id"
            params={{ id: p.id }}
            style={{ animationDelay: `${i * 60}ms` }}
            className="group relative flex flex-col rounded-xl border border-[var(--border-muted)] bg-white overflow-hidden hover:-translate-y-1 hover:border-[var(--heat-100)] hover:shadow-[0_24px_56px_-24px_var(--heat-40)] transition-all duration-300 animate-fade-up"
          >
            {/* Big discount tag */}
            <div className="absolute top-4 left-4 z-10 flex items-baseline gap-1 rounded-md bg-[var(--heat-100)] px-2.5 py-1.5 shadow-[0_4px_12px_0_var(--heat-40)]">
              <span className="font-display text-[22px] leading-none font-medium text-white">
                {discountPct(p)}
              </span>
              <span className="text-mono-x-small uppercase tracking-wider text-white/85">% off</span>
            </div>

            <div className="aspect-[4/3] bg-[var(--background-lighter)] overflow-hidden">
              <img
                src={(p.images?.[0]) ?? p.image}
                alt={p.title}
                className="size-full object-contain p-6 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
              />
            </div>

            <div className="border-t border-[var(--border-faint)] p-5">
              <p className="text-mono-x-small uppercase tracking-[0.14em] text-[var(--black-alpha-48)]">{p.brand}</p>
              <p className="mt-1 line-clamp-2 text-label-medium text-foreground min-h-[40px]">{p.title}</p>
              <div className="mt-3 flex items-baseline justify-between border-t border-[var(--border-faint)] pt-3">
                <div>
                  <p className="font-display text-[22px] leading-none font-medium text-foreground">{formatINR(p.price)}</p>
                  <p className="mt-1 text-mono-x-small text-[var(--black-alpha-40)] line-through">{formatINR(p.mrp)}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-mono-x-small uppercase tracking-wider text-[var(--accent-forest)]">
                  save<br /><span className="text-foreground text-mono-small">{formatINR(p.mrp - p.price)}</span>
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   BUILD YOUR LAPTOP — 3 spec lanes
   ═════════════════════════════════════════════════════════════════════════ */
function BuildYourLaptop({
  memory,
  power,
  compute,
}: {
  memory: Product[];
  power: Product[];
  compute: Product[];
}) {
  const lanes = [
    { icon: HardDrive, label: "memory & storage", title: "Speed up boot times", items: memory, cat: "ssd" },
    { icon: Battery, label: "power & display", title: "Run longer, look better", items: power, cat: "batteries" },
    { icon: Cpu, label: "compute & cooling", title: "Push the silicon", items: compute, cat: "processors" },
  ];

  return (
    <section className="container mx-auto px-4 pt-24">
      <div className="mb-10 max-w-2xl">
        <span className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-100)]">03 / upgrade paths</span>
        <h2 className="mt-2 font-display text-title-h3 text-foreground text-balance">Pick a path. We'll match the part.</h2>
        <p className="mt-2 text-body-medium text-[var(--black-alpha-56)]">
          Three upgrade lanes. Curated picks per category. Compatibility tagged on every SKU.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {lanes.map((lane, idx) => (
          <div
            key={lane.label}
            style={{ animationDelay: `${idx * 80}ms` }}
            className="rounded-xl border border-[var(--border-muted)] bg-white p-6 animate-fade-up"
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-mono-x-small uppercase tracking-[0.18em] text-[var(--heat-100)]">{lane.label}</p>
                <h3 className="mt-1 font-display text-title-h5 text-foreground">{lane.title}</h3>
              </div>
              <div className="grid size-10 place-items-center rounded-md border border-[var(--border-faint)] bg-[var(--heat-4)] text-[var(--heat-100)]">
                <lane.icon className="size-4" strokeWidth={2.2} />
              </div>
            </div>

            <div className="space-y-3">
              {lane.items.map((p) => (
                <Link
                  key={p.id}
                  to="/product/$id"
                  params={{ id: p.id }}
                  className="group flex gap-4 rounded-lg border border-[var(--border-faint)] p-3 hover:border-[var(--heat-20)] hover:bg-[var(--heat-4)] transition-all"
                >
                  <img
                    src={(p.images?.[0]) ?? p.image}
                    alt={p.title}
                    className="size-16 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] object-contain p-1.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-mono-x-small uppercase tracking-[0.14em] text-[var(--black-alpha-48)]">{p.brand}</p>
                    <p className="mt-0.5 line-clamp-2 text-label-small text-foreground leading-snug">{p.title}</p>
                    <p className="mt-1.5 text-label-small font-medium text-foreground">
                      {formatINR(p.price)}
                      <span className="ml-2 text-mono-x-small text-[var(--accent-forest)] tracking-wider uppercase">
                        −{discountPct(p)}%
                      </span>
                    </p>
                  </div>
                  <ArrowUpRight className="size-3.5 text-[var(--black-alpha-32)] group-hover:text-[var(--heat-100)] transition-colors" />
                </Link>
              ))}
            </div>

            <Link
              to="/products"
              search={{ category: lane.cat }}
              className="mt-5 inline-flex items-center gap-1.5 text-label-small text-[var(--heat-100)] hover:underline"
            >
              Explore lane <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   EDITORS PICKS — standard product grid
   ═════════════════════════════════════════════════════════════════════════ */
function EditorsPicks({ items }: { items: Product[] }) {
  return (
    <section className="container mx-auto px-4 pt-24">
      <div className="flex items-end justify-between mb-8 gap-6 flex-wrap">
        <div>
          <span className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-100)]">04 / editor picks</span>
          <h2 className="mt-2 font-display text-title-h3 text-foreground">Highest-rated components</h2>
          <p className="mt-1 text-body-medium text-[var(--black-alpha-56)]">Sorted by customer reviews — 4.5★ and above.</p>
        </div>
        <Link to="/products" className="group inline-flex items-center gap-1.5 text-label-small text-foreground hover:text-[var(--heat-100)] transition-colors">
          View all <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((p, i) => (
          <div key={p.id} className="animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
            <ProductCard p={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   SPEC BANNER — dark CTA strip
   ═════════════════════════════════════════════════════════════════════════ */
function SpecBanner() {
  return (
    <section className="container mx-auto px-4 pt-24">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-muted)] bg-[var(--accent-black)] grain">
        <div className="pointer-events-none absolute -top-20 -right-20 h-[320px] w-[320px] rounded-full bg-[var(--heat-100)] opacity-25 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-[200px] w-[200px] rounded-full bg-[var(--heat-200)] opacity-12 blur-[100px]" />

        <div className="relative grid gap-10 p-10 md:grid-cols-[1.4fr_1fr] md:p-14">
          <div>
            <span className="inline-flex items-center gap-2 text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-200)]">
              <Zap className="size-3" strokeWidth={2.6} /> not sure what fits?
            </span>
            <h3 className="mt-3 font-display text-[42px] md:text-[56px] leading-[1.02] tracking-[-0.025em] font-medium text-white text-balance">
              Tell us your laptop.<br />
              <span className="text-gradient-heat">We'll find the part.</span>
            </h3>
            <p className="mt-5 max-w-md text-body-large text-white/65">
              Use catalog filters and compatibility notes to match your model number with RAM, SSDs, batteries,
              and displays.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/products"
                className="button button-primary inline-flex items-center gap-2 rounded-md px-6 h-12 text-label-medium text-white"
              >
                <Sparkles className="size-4" />
                Find compatible parts
              </Link>
              <Link
                to="/products"
                className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-6 h-12 text-label-medium text-white hover:bg-white/[0.08] hover:border-white/30 transition-all"
              >
                Browse catalog <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </div>

          {/* Right: spec rail */}
          <div className="hidden md:flex flex-col gap-3">
            {[
              ["compatibility check", "instant model lookup"],
              ["genuine guarantee", "brand-certified suppliers"],
              ["fast dispatch", "48h to most cities"],
              ["expert help", "ping support · Mon–Sat"],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] backdrop-blur p-4"
              >
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--heat-100)]" />
                <div>
                  <p className="text-mono-x-small uppercase tracking-[0.18em] text-white/45">{k}</p>
                  <p className="mt-0.5 text-label-small text-white">{v}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   TRENDING
   ═════════════════════════════════════════════════════════════════════════ */
function Trending({ items }: { items: Product[] }) {
  return (
    <section className="container mx-auto px-4 pt-24">
      <div className="flex items-end justify-between mb-8 gap-6 flex-wrap">
        <div>
          <span className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-100)]">05 / trending</span>
          <h2 className="mt-2 font-display text-title-h3 text-foreground">Moving fast this week</h2>
          <p className="mt-1 text-body-medium text-[var(--black-alpha-56)]">Updated daily based on cart adds.</p>
        </div>
        <Link to="/products" className="group inline-flex items-center gap-1.5 text-label-small text-foreground hover:text-[var(--heat-100)] transition-colors">
          See all <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((p, i) => (
          <div key={p.id} className="animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
            <ProductCard p={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   BRAND STRIP — mono wordmarks
   ═════════════════════════════════════════════════════════════════════════ */
function BrandStrip() {
  const brands = ["intel", "amd", "samsung", "kingston", "crucial", "wd", "hp", "dell", "lenovo", "lg", "auo", "cooler master"];
  return (
    <section className="container mx-auto px-4 pt-24">
      <div className="text-center mb-10">
        <span className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-100)]">06 / suppliers</span>
        <h2 className="mt-2 font-display text-title-h4 text-foreground">Authorized brand partners</h2>
      </div>
      <div className="rounded-xl border border-[var(--border-faint)] bg-white px-4 py-10">
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-y-8 gap-x-6 text-center">
          {brands.map((b) => (
            <div
              key={b}
              className="font-mono text-mono-medium uppercase tracking-[0.18em] text-[var(--black-alpha-48)] hover:text-[var(--heat-100)] transition-colors cursor-default"
            >
              {b}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   NEWSLETTER — dark CTA
   ═════════════════════════════════════════════════════════════════════════ */
function Newsletter() {
  return (
    <section className="container mx-auto px-4 pt-24 pb-12">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-muted)] bg-[var(--background-lighter)] p-10 md:p-14">
        <div className="pointer-events-none absolute -top-20 -left-10 h-[260px] w-[260px] rounded-full bg-[var(--heat-100)] opacity-10 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-20 -right-10 h-[220px] w-[220px] rounded-full bg-[var(--heat-200)] opacity-8 blur-[100px]" />

        <div className="relative grid gap-8 md:grid-cols-[1.3fr_1fr] items-center">
          <div>
            <span className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-100)]">drop_list</span>
            <h3 className="mt-2 font-display text-title-h3 text-foreground text-balance">
              Get the parts drop, every Monday.
            </h3>
            <p className="mt-3 text-body-medium text-[var(--black-alpha-64)] max-w-md">
              New deals, restocks, and compatibility guides. No spam. Unsubscribe in one click.
            </p>
          </div>

          <form
            onSubmit={(e) => e.preventDefault()}
            className="flex flex-col gap-2 w-full"
          >
            <div className="flex h-12 items-center rounded-md border border-[var(--border-muted)] bg-white overflow-hidden focus-within:border-[var(--heat-100)] focus-within:shadow-[0_0_0_3px_var(--heat-12)] transition-all">
              <input
                type="email"
                required
                placeholder="you@laptop.com"
                className="flex-1 h-full bg-transparent px-4 text-body-medium outline-none placeholder:text-[var(--black-alpha-32)]"
              />
              <button
                type="submit"
                className="button button-primary mr-1 my-1 inline-flex items-center gap-1.5 rounded-md px-4 h-10 text-label-small"
              >
                Subscribe <ArrowRight className="size-3.5" />
              </button>
            </div>
            <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-40)] pl-1">
              we send · max once a week
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}

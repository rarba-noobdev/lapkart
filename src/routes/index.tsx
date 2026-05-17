import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { categories, products } from "@/lib/catalog";
import { Truck, ShieldCheck, RotateCcw, Headphones, ArrowRight, Zap } from "lucide-react";
import hero from "@/assets/hero.jpg";
import bannerSsd from "@/assets/banner-ssd.jpg";
import bannerRam from "@/assets/banner-ram.jpg";
import bannerBattery from "@/assets/banner-battery.jpg";
import bannerDisplay from "@/assets/banner-display.jpg";
import bannerMega from "@/assets/banner-mega.jpg";
import brandIntel from "@/assets/brand-intel.jpg";
import brandSamsung from "@/assets/brand-samsung.jpg";
import brandHp from "@/assets/brand-hp.jpg";
import brandDell from "@/assets/brand-dell.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LapKart — Genuine Laptop Components & Repair Parts" },
      {
        name: "description",
        content:
          "Shop genuine laptop RAM, SSDs, batteries, displays, motherboards, chargers and repair parts at the best prices. Fast delivery across India.",
      },
      { property: "og:title", content: "LapKart — Genuine Laptop Components" },
      {
        property: "og:description",
        content: "India's marketplace for laptop spare parts. Genuine. Tested. Delivered fast.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const featured = products.slice(0, 6);
  const trending = products.slice(6, 12);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[var(--gradient-hero)] text-white">
        <div className="container mx-auto grid items-center gap-8 px-4 py-10 md:grid-cols-2 md:py-16">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron px-3 py-1 text-xs font-bold text-saffron-foreground">
              <Zap className="size-3.5 fill-current" /> FLASH SALE · UP TO 60% OFF
            </span>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
              Every part your <br className="hidden sm:block" />
              laptop deserves.
            </h1>
            <p className="max-w-md text-base text-white/85">
              Genuine RAM, SSDs, batteries, displays, processors and 10,000+ repair parts —
              tested, certified, delivered fast.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 rounded-sm bg-saffron px-6 py-3 text-sm font-bold text-saffron-foreground shadow-lg transition hover:brightness-105"
              >
                Shop Components <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/products"
                className="inline-flex items-center gap-2 rounded-sm border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold backdrop-blur transition hover:bg-white/20"
              >
                Browse Categories
              </Link>
            </div>
          </div>
          <div className="relative">
            <img
              src={hero}
              alt="Laptop components floating"
              width={1600}
              height={768}
              className="w-full rounded-xl shadow-[var(--shadow-pop)]"
            />
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-border bg-card">
        <div className="container mx-auto grid grid-cols-2 gap-4 px-4 py-5 text-sm md:grid-cols-4">
          {[
            { i: Truck, t: "Fast Delivery", s: "Across India" },
            { i: ShieldCheck, t: "100% Genuine", s: "Brand certified" },
            { i: RotateCcw, t: "Easy Returns", s: "7-day policy" },
            { i: Headphones, t: "Expert Support", s: "Mon–Sat 9–7" },
          ].map(({ i: Icon, t, s }) => (
            <div key={t} className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <div>
                <p className="font-semibold">{t}</p>
                <p className="text-xs text-muted-foreground">{s}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="container mx-auto px-4 py-10">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">Shop by Category</h2>
            <p className="text-sm text-muted-foreground">From RAM to repair kits — all in one place.</p>
          </div>
          <Link to="/products" className="text-sm font-semibold text-primary hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {categories.map((c) => (
            <Link
              key={c.slug}
              to="/products"
              search={{ category: c.slug }}
              className="group flex flex-col items-center gap-2 rounded-lg border border-transparent bg-card p-3 text-center transition hover:border-primary/30 hover:shadow-[var(--shadow-card-hover)]"
            >
              <div className="aspect-square w-full overflow-hidden rounded-md bg-white">
                <img
                  src={c.image}
                  alt={c.name}
                  loading="lazy"
                  className="size-full object-contain p-2 transition group-hover:scale-110"
                />
              </div>
              <span className="text-xs font-semibold">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Flash sale banner */}
      <section className="container mx-auto px-4">
        <div className="overflow-hidden rounded-xl bg-[var(--gradient-saffron)] p-6 text-saffron-foreground sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest">Limited time</p>
              <h3 className="font-display text-2xl font-bold sm:text-3xl">
                Big Component Days — Min 40% off Storage & RAM
              </h3>
            </div>
            <Link
              to="/products"
              className="rounded-sm bg-foreground px-5 py-2.5 text-sm font-bold text-background"
            >
              Grab Deals
            </Link>
          </div>
        </div>
      </section>

      {/* Featured */}
      <Section title="Featured Products" subtitle="Hand-picked components customers love.">
        <Grid items={featured} />
      </Section>

      {/* Trending */}
      <Section title="Trending Laptop Parts" subtitle="What everyone's buying this week.">
        <Grid items={trending} />
      </Section>

      <Footer />
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="container mx-auto px-4 py-10">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Link to="/products" className="text-sm font-semibold text-primary hover:underline">
          See all →
        </Link>
      </div>
      {children}
    </section>
  );
}

function Grid({ items }: { items: typeof products }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((p) => (
        <ProductCard key={p.id} p={p} />
      ))}
    </div>
  );
}

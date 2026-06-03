import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { HomeLoadingSkeleton } from "@/components/LoadingSkeletons";
import { ProductCard } from "@/components/ProductCard";
import { categories, discountPct, formatINR, type Product } from "@/lib/catalog";
import { useProducts } from "@/lib/products-db";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "lapkart - Genuine laptop components, delivered fast" },
      {
        name: "description",
        content:
          "Shop genuine laptop parts with fast dispatch, compatibility guidance, and clear pricing across RAM, SSDs, batteries, displays, and replacement hardware.",
      },
      { property: "og:title", content: "lapkart - laptop parts storefront" },
    ],
  }),
  component: Home,
});

const byRating = (a: Product, b: Product) => b.rating - a.rating;
const bySavings = (a: Product, b: Product) => b.mrp - b.price - (a.mrp - a.price);

function Home() {
  const { data: products = [], isLoading } = useProducts();

  const topRated = [...products].sort(byRating);
  const bestSellers = topRated.slice(0, 6);
  const dealProducts = [...products].sort(bySavings);
  const heroPrimary = products.find((product) => product.category === "ssd") ?? topRated[0];
  const heroSecondary = products.find((product) => product.category === "batteries") ?? topRated[1];
  const displayLead = products.find((product) => product.category === "displays") ?? topRated[2];
  const leadDeal = dealProducts[0];
  const moreDeals = dealProducts.slice(1, 4);

  const browseRail = categories
    .filter((category) =>
      ["ssd", "batteries", "ram", "displays", "chargers"].includes(category.slug),
    )
    .map((category) => ({
      slug: category.slug,
      name: category.name,
    }));

  const categoryHighlights = [
    {
      slug: "ssd",
      name: "Storage upgrades",
      body: "Faster boot times, clean replacements, and dependable daily-performance parts.",
      product: products.find((product) => product.category === "ssd") ?? topRated[0],
    },
    {
      slug: "batteries",
      name: "Battery replacements",
      body: "For worn packs, weak backup times, and laptops that need to leave the charger again.",
      product: products.find((product) => product.category === "batteries") ?? topRated[1],
    },
    {
      slug: "displays",
      name: "Screen repairs",
      body: "Panels and assemblies for cracked displays, dead pixels, and rough hinge damage.",
      product: products.find((product) => product.category === "displays") ?? topRated[2],
    },
  ].filter((item) => item.product);

  const brandPartners = [
    ...new Set(products.map((product) => product.brand).filter(Boolean)),
  ].slice(0, 6);

  return (
    <div className="min-h-screen bg-[var(--background-base)] text-foreground">
      <Header />

      {isLoading && products.length === 0 ? (
        <HomeLoadingSkeleton />
      ) : (
        <>
          <Hero heroPrimary={heroPrimary} heroSecondary={heroSecondary} displayLead={displayLead} />
          <BrowseRail items={browseRail} />
          {bestSellers.length > 0 && <BestsellerShelf items={bestSellers} />}
          <RepairPaths items={categoryHighlights} />
          {leadDeal && <DealSection leadDeal={leadDeal} items={moreDeals} />}
          <SupportSection />
          <BrandStrip items={brandPartners} />
          <Newsletter />
        </>
      )}

      <Footer />
    </div>
  );
}

function Hero({
  heroPrimary,
  heroSecondary,
  displayLead,
}: {
  heroPrimary?: Product;
  heroSecondary?: Product;
  displayLead?: Product;
}) {
  return (
    <section className="container mx-auto px-4 pb-14 pt-8 md:pb-16 md:pt-10">
      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="flex flex-col justify-center rounded-[16px] bg-white p-7 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.16)] md:p-10">
          <p className="text-body-small text-[var(--black-alpha-56)]">
            For repairs, refreshes, and urgent replacements.
          </p>
          <h1 className="mt-4 max-w-[12ch] text-balance font-display text-[clamp(3rem,6vw,5.2rem)] leading-[0.96] tracking-[-0.035em] text-foreground">
            Laptop parts you can buy with less doubt.
          </h1>
          <p className="mt-5 max-w-[33rem] text-body-large text-[var(--black-alpha-72)]">
            Genuine and replacement components for upgrades, dead batteries, storage swaps, and
            damaged screens, with clearer pricing and faster paths to the right part.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/products"
              className="button button-primary inline-flex h-12 items-center gap-2 rounded-md px-6 text-label-medium text-white"
            >
              Shop all parts
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/products"
              search={{ category: "batteries" }}
              className="inline-flex h-12 items-center gap-2 rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] px-6 text-label-medium text-foreground transition-[border-color,background-color,color] hover:border-[var(--heat-100)] hover:bg-[var(--heat-4)] hover:text-[var(--heat-100)]"
            >
              Browse batteries
              <ArrowUpRight className="size-4" />
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-body-small text-[var(--black-alpha-64)]">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4 text-[var(--heat-100)]" />
              Verified stock visibility
            </span>
            <span className="inline-flex items-center gap-2">
              <Truck className="size-4 text-[var(--heat-100)]" />
              Fast dispatch on common parts
            </span>
            <span className="inline-flex items-center gap-2">
              <RotateCcw className="size-4 text-[var(--heat-100)]" />
              Returns and warranty support
            </span>
          </div>
        </div>

        <div className="rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-5 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.12)] md:p-6">
          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex min-h-[320px] items-center justify-center rounded-[14px] bg-white p-6">
              {heroPrimary ? (
                <img
                  src={heroPrimary.images?.[0] ?? heroPrimary.image}
                  alt={heroPrimary.title}
                  className="max-h-[280px] w-full object-contain"
                />
              ) : (
                <div className="text-body-small text-[var(--black-alpha-48)]">Top SSD shelf</div>
              )}
            </div>

            <div className="grid gap-4">
              <div className="rounded-[14px] bg-white p-5">
                <p className="text-body-small text-[var(--black-alpha-56)]">
                  Moving fastest right now
                </p>
                {heroSecondary ? (
                  <>
                    <p className="mt-2 line-clamp-2 text-label-large text-foreground">
                      {heroSecondary.title}
                    </p>
                    <p className="mt-3 text-body-small text-[var(--black-alpha-64)]">
                      Faster dispatch for common replacement orders.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-body-small text-[var(--black-alpha-64)]">
                    Battery replacements, SSD upgrades, and screen parts are the most active shelves
                    this week.
                  </p>
                )}
              </div>

              <div className="flex min-h-[168px] items-center justify-center rounded-[14px] bg-white p-5">
                {displayLead ? (
                  <img
                    src={displayLead.images?.[0] ?? displayLead.image}
                    alt={displayLead.title}
                    className="max-h-[140px] w-full object-contain"
                  />
                ) : (
                  <div className="text-body-small text-[var(--black-alpha-48)]">
                    Active replacement shelves
                  </div>
                )}
              </div>
            </div>
          </div>

          {heroPrimary && (
            <Link
              to="/product/$id"
              params={{ id: heroPrimary.id }}
              className="mt-4 grid gap-4 rounded-[14px] border border-[var(--heat-16)] bg-white p-5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--heat-100)] md:grid-cols-[1fr_auto]"
            >
              <div>
                <p className="text-body-small text-[var(--black-alpha-56)]">
                  Most bought this week
                </p>
                <p className="mt-1 line-clamp-2 text-label-large text-foreground">
                  {heroPrimary.title}
                </p>
              </div>
              <div className="flex items-end gap-3 md:items-center">
                <div className="text-right">
                  <p className="text-label-large font-medium text-foreground">
                    {formatINR(heroPrimary.price)}
                  </p>
                  <p className="mt-1 text-body-small text-[var(--black-alpha-40)] line-through">
                    {formatINR(heroPrimary.mrp)}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--heat-8)] px-3 py-1 text-mono-small text-[var(--heat-100)]">
                  Save {discountPct(heroPrimary)}%
                </span>
              </div>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function BrowseRail({ items }: { items: Array<{ slug: string; name: string }> }) {
  return (
    <section className="container mx-auto px-4">
      <div className="rounded-[16px] border border-[var(--border-faint)] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-label-medium text-foreground">Browse the shelves people open first</p>
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <Link
                key={item.slug}
                to="/products"
                search={{ category: item.slug }}
                className="rounded-full border border-[var(--border-faint)] bg-[var(--background-lighter)] px-4 py-2 text-label-small text-foreground transition-[border-color,background-color,color] hover:border-[var(--heat-100)] hover:bg-[var(--heat-4)] hover:text-[var(--heat-100)]"
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BestsellerShelf({ items }: { items: Product[] }) {
  return (
    <section className="container mx-auto px-4 pt-16">
      <div className="mb-8">
        <h2 className="font-display text-title-h3 text-foreground">
          Bestsellers for upgrades and quick repairs
        </h2>
        <p className="mt-2 max-w-[42rem] text-body-medium text-[var(--black-alpha-56)]">
          A storefront shortlist for the parts customers buy most often when a machine needs to get
          back to work fast.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((product) => (
          <ProductCard key={product.id} p={product} />
        ))}
      </div>
    </section>
  );
}

function RepairPaths({
  items,
}: {
  items: Array<{ slug: string; name: string; body: string; product?: Product }>;
}) {
  const [lead, ...rest] = items;

  return (
    <section className="container mx-auto px-4 pt-16">
      <div className="mb-8">
        <h2 className="font-display text-title-h3 text-foreground">
          Shop by the fix you need to make
        </h2>
        <p className="mt-2 max-w-[42rem] text-body-medium text-[var(--black-alpha-56)]">
          Start with the repair path, then narrow by model, fitment, and stock.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <Link
          to="/products"
          search={{ category: lead.slug }}
          className="group grid overflow-hidden rounded-[16px] border border-[var(--border-faint)] bg-white transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-[var(--heat-20)] hover:shadow-[0_20px_44px_-30px_var(--heat-40)] md:grid-cols-[1.04fr_0.96fr]"
        >
          <div className="flex flex-col justify-between p-6 md:p-8">
            <div>
              <h3 className="font-display text-title-h4 text-foreground">{lead.name}</h3>
              <p className="mt-3 max-w-[28rem] text-body-medium text-[var(--black-alpha-56)]">
                {lead.body}
              </p>
            </div>
            <span className="mt-6 inline-flex items-center gap-1.5 text-label-small text-[var(--heat-100)]">
              Shop this shelf <ArrowUpRight className="size-4" />
            </span>
          </div>
          <div className="flex items-center justify-center bg-[var(--background-lighter)] p-6">
            {lead.product ? (
              <img
                src={lead.product.images?.[0] ?? lead.product.image}
                alt={lead.product.title}
                className="max-h-[280px] w-full object-contain"
              />
            ) : (
              <div className="text-body-small text-[var(--black-alpha-48)]">{lead.name}</div>
            )}
          </div>
        </Link>

        <div className="grid gap-4">
          {rest.map((item) => (
            <Link
              key={item.slug}
              to="/products"
              search={{ category: item.slug }}
              className="group grid overflow-hidden rounded-[16px] border border-[var(--border-faint)] bg-white transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-[var(--heat-20)] hover:shadow-[0_18px_38px_-30px_var(--heat-40)] sm:grid-cols-[0.88fr_1.12fr]"
            >
              <div className="flex items-center justify-center bg-[var(--background-lighter)] p-5">
                {item.product ? (
                  <img
                    src={item.product.images?.[0] ?? item.product.image}
                    alt={item.product.title}
                    className="max-h-[140px] w-full object-contain"
                  />
                ) : (
                  <div className="text-body-small text-[var(--black-alpha-48)]">{item.name}</div>
                )}
              </div>
              <div className="flex flex-col justify-between p-5">
                <div>
                  <h3 className="text-label-large text-foreground">{item.name}</h3>
                  <p className="mt-2 text-body-small text-[var(--black-alpha-56)]">{item.body}</p>
                </div>
                <span className="mt-4 inline-flex items-center gap-1.5 text-label-small text-[var(--heat-100)]">
                  Browse parts <ArrowUpRight className="size-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function DealSection({ leadDeal, items }: { leadDeal: Product; items: Product[] }) {
  return (
    <section className="container mx-auto px-4 pt-16">
      <div className="mb-8">
        <h2 className="font-display text-title-h3 text-foreground">
          Deals worth catching before stock moves
        </h2>
        <p className="mt-2 max-w-[42rem] text-body-medium text-[var(--black-alpha-56)]">
          Current discounts on parts people are already searching for.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
        <Link
          to="/product/$id"
          params={{ id: leadDeal.id }}
          className="group grid overflow-hidden rounded-[16px] border border-[var(--border-faint)] bg-white transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-[var(--heat-20)] hover:shadow-[0_20px_44px_-30px_var(--heat-40)] md:grid-cols-[1fr_1fr]"
        >
          <div className="flex flex-col justify-between p-6 md:p-8">
            <div>
              <h3 className="font-display text-title-h4 text-foreground">{leadDeal.title}</h3>
              <p className="mt-3 text-body-medium text-[var(--black-alpha-56)]">
                One of the clearest price drops on the storefront right now, with the important part
                details still easy to scan.
              </p>
            </div>

            <div className="mt-8 flex items-end justify-between gap-4">
              <div>
                <p className="text-label-large font-medium text-foreground">
                  {formatINR(leadDeal.price)}
                </p>
                <p className="mt-1 text-body-small text-[var(--black-alpha-40)] line-through">
                  {formatINR(leadDeal.mrp)}
                </p>
              </div>
              <span className="rounded-full bg-[var(--heat-8)] px-3 py-1 text-mono-small text-[var(--heat-100)]">
                Save {discountPct(leadDeal)}%
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center bg-[var(--background-lighter)] p-8">
            <img
              src={leadDeal.images?.[0] ?? leadDeal.image}
              alt={leadDeal.title}
              className="max-h-[260px] w-full object-contain"
            />
          </div>
        </Link>

        <div className="rounded-[16px] border border-[var(--border-faint)] bg-white p-4 md:p-5">
          <div className="divide-y divide-[var(--border-faint)]">
            {items.map((item) => (
              <Link
                key={item.id}
                to="/product/$id"
                params={{ id: item.id }}
                className="group grid gap-4 py-4 first:pt-1 last:pb-1 sm:grid-cols-[92px_1fr_auto]"
              >
                <div className="flex h-[92px] items-center justify-center rounded-[12px] bg-[var(--background-lighter)] p-3">
                  <img
                    src={item.images?.[0] ?? item.image}
                    alt={item.title}
                    className="max-h-[72px] w-full object-contain"
                  />
                </div>
                <div>
                  <p className="line-clamp-2 text-label-medium text-foreground transition-colors group-hover:text-[var(--heat-100)]">
                    {item.title}
                  </p>
                  <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">{item.brand}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-label-medium font-medium text-foreground">
                    {formatINR(item.price)}
                  </p>
                  <p className="mt-1 text-body-small text-[var(--black-alpha-40)] line-through">
                    {formatINR(item.mrp)}
                  </p>
                  <p className="mt-2 text-mono-x-small text-[var(--heat-100)]">
                    Save {discountPct(item)}%
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SupportSection() {
  const items = [
    {
      icon: ShieldCheck,
      title: "Verified listings",
      body: "Genuine and replacement inventory is easier to separate before the order goes through.",
    },
    {
      icon: Truck,
      title: "Fast dispatch",
      body: "Common shelves are set up for shoppers who need a working machine back quickly.",
    },
    {
      icon: RotateCcw,
      title: "Returns and warranty",
      body: "Support stays visible after payment instead of disappearing behind the checkout.",
    },
  ];

  return (
    <section className="container mx-auto px-4 pt-16">
      <div className="rounded-[16px] border border-[var(--heat-16)] bg-[var(--heat-4)] p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="max-w-[30rem]">
            <h2 className="font-display text-title-h3 text-foreground">
              A better parts storefront explains the risky bits early.
            </h2>
            <p className="mt-3 text-body-medium text-[var(--black-alpha-64)]">
              Fitment, dispatch, and after-sales support should be visible before a customer
              commits, not after the payment page.
            </p>
            <Link
              to="/orders"
              className="mt-5 inline-flex items-center gap-1.5 text-label-small text-[var(--heat-100)]"
            >
              Track an order <ArrowUpRight className="size-4" />
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {items.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <div className="grid size-10 place-items-center rounded-[12px] bg-white text-[var(--heat-100)]">
                  <Icon className="size-5" strokeWidth={2} />
                </div>
                <p className="mt-4 text-label-large text-foreground">{title}</p>
                <p className="mt-2 text-body-small text-[var(--black-alpha-56)]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BrandStrip({ items }: { items: string[] }) {
  return (
    <section className="container mx-auto px-4 pt-16">
      <div className="rounded-[16px] border border-[var(--border-faint)] bg-white p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-label-medium text-foreground">
            Brands customers already come looking for.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {items.map((item) => (
              <div
                key={item}
                className="flex min-h-20 items-center justify-center rounded-[12px] bg-[var(--background-lighter)] px-6 py-4"
              >
                <span className="text-label-large text-[var(--black-alpha-72)]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Newsletter() {
  return (
    <section className="container mx-auto px-4 pb-12 pt-16">
      <div className="rounded-[16px] border border-[var(--border-faint)] bg-white p-6 md:p-8">
        <div className="grid gap-6 md:grid-cols-[1fr_0.95fr] md:items-end">
          <div className="max-w-[34rem]">
            <h2 className="font-display text-title-h3 text-foreground">
              Get a note when the right part is back or priced better.
            </h2>
            <p className="mt-3 text-body-medium text-[var(--black-alpha-64)]">
              Restocks, useful price drops, and compatibility updates, usually one helpful email a
              week.
            </p>
          </div>

          <form onSubmit={(event) => event.preventDefault()} className="flex w-full flex-col gap-2">
            <label htmlFor="newsletter-email" className="text-label-small text-foreground">
              Email address
            </label>
            <div className="flex h-12 items-center overflow-hidden rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] transition-[border-color,box-shadow] focus-within:border-[var(--heat-100)] focus-within:shadow-[0_0_0_3px_var(--heat-12)]">
              <input
                id="newsletter-email"
                type="email"
                required
                placeholder="you@example.com"
                className="h-full flex-1 bg-transparent px-4 text-body-medium placeholder:text-[var(--black-alpha-48)]"
              />
              <button
                type="submit"
                className="button button-primary my-1 mr-1 inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-label-small text-white"
              >
                Subscribe <ArrowRight className="size-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border-muted)] bg-white">
      <Skeleton className="aspect-square rounded-none bg-[var(--black-alpha-4)]" />
      <div className="space-y-3 px-4 py-4">
        <Skeleton className="h-3 w-16 bg-[var(--black-alpha-8)]" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full bg-[var(--black-alpha-8)]" />
          <Skeleton className="h-4 w-3/4 bg-[var(--black-alpha-8)]" />
        </div>
        <Skeleton className="h-3 w-20 bg-[var(--black-alpha-8)]" />
        <div className="border-t border-[var(--border-faint)] pt-3">
          <Skeleton className="h-5 w-28 bg-[var(--black-alpha-8)]" />
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      aria-label="Loading products"
      aria-busy="true"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      role="status"
    >
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function HomeLoadingSkeleton() {
  return (
    <>
      <section
        aria-label="Loading storefront"
        aria-busy="true"
        className="bg-[var(--accent-black)]"
        role="status"
      >
        <div className="container mx-auto grid gap-12 px-4 py-20 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:py-28">
          <div className="space-y-6">
            <Skeleton className="h-3 w-56 bg-white/10" />
            <Skeleton className="h-16 w-full max-w-xl bg-white/10 md:h-24" />
            <Skeleton className="h-16 w-full max-w-md bg-white/10" />
            <div className="flex gap-3">
              <Skeleton className="h-12 w-40 bg-white/10" />
              <Skeleton className="h-12 w-32 bg-white/10" />
            </div>
          </div>
          <Skeleton className="hidden aspect-square max-h-[360px] rounded-lg bg-white/10 lg:block" />
        </div>
      </section>
      <section className="container mx-auto px-4 py-12">
        <Skeleton className="mb-6 h-6 w-48 bg-[var(--black-alpha-8)]" />
        <ProductGridSkeleton count={4} />
      </section>
    </>
  );
}

export function CartPageSkeleton() {
  return (
    <div
      aria-label="Loading cart"
      aria-busy="true"
      className="container mx-auto px-4 py-10"
      role="status"
    >
      <Skeleton className="h-3 w-16 bg-[var(--black-alpha-8)]" />
      <Skeleton className="mt-3 h-9 w-52 bg-[var(--black-alpha-8)]" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="rounded-lg border border-[var(--border-muted)] bg-white">
          {Array.from({ length: 2 }, (_, index) => (
            <div
              key={index}
              className="flex gap-5 border-b border-[var(--border-faint)] p-5 last:border-0"
            >
              <Skeleton className="size-24 shrink-0 bg-[var(--black-alpha-8)]" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-3 w-16 bg-[var(--black-alpha-8)]" />
                <Skeleton className="h-4 w-4/5 bg-[var(--black-alpha-8)]" />
                <Skeleton className="h-9 w-28 bg-[var(--black-alpha-8)]" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-fit rounded-lg border border-[var(--border-muted)] bg-white p-6">
          <Skeleton className="h-3 w-28 bg-[var(--black-alpha-8)]" />
          <div className="mt-6 space-y-4">
            <Skeleton className="h-4 w-full bg-[var(--black-alpha-8)]" />
            <Skeleton className="h-4 w-full bg-[var(--black-alpha-8)]" />
            <Skeleton className="h-12 w-full bg-[var(--black-alpha-8)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CheckoutCartSkeleton() {
  return (
    <div aria-label="Loading order summary" aria-busy="true" className="space-y-4" role="status">
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} className="flex items-start gap-3">
          <Skeleton className="size-16 shrink-0 bg-[var(--black-alpha-8)]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full bg-[var(--black-alpha-8)]" />
            <Skeleton className="h-3 w-2/3 bg-[var(--black-alpha-8)]" />
            <Skeleton className="h-4 w-20 bg-[var(--black-alpha-8)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Bell,
  Check,
  Heart,
  Loader2,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { useAuth } from "@/lib/auth";
import { apiBase } from "@/lib/api-base";
import { discountPct, formatINR } from "@/lib/catalog";
import { cart } from "@/lib/cart-store";
import { supabase } from "@/integrations/supabase/client";
import { getAuthorizationHeaders } from "@/lib/supabase-auth";
import { useProduct, useProducts } from "@/lib/products-db";

export const Route = createFileRoute("/product/$id")({
  head: () => ({ meta: [{ title: "Product - lapkart" }] }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { role, user } = useAuth();
  const { data: product, isLoading } = useProduct(id);
  const { data: allProducts = [] } = useProducts();
  const [added, setAdded] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [wishlistSaved, setWishlistSaved] = useState(false);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [questionBody, setQuestionBody] = useState("");
  const [stockEmail, setStockEmail] = useState(user?.email ?? "");
  const [savingAux, setSavingAux] = useState<string | null>(null);
  const navigate = useNavigate();
  const isAdmin = role === "admin";

  const loadReviews = useCallback(async () => {
    const { data } = await supabase
      .from("product_reviews")
      .select("id,rating,title,body,verified_purchase,created_at")
      .eq("product_id", id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(12);
    setReviews((data as ProductReview[] | null) ?? []);
  }, [id]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const loadQuestions = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/products/${id}/questions`);
      const data = (await response.json().catch(() => null)) as {
        questions?: ProductQuestion[];
      } | null;
      if (!response.ok) throw new Error("Could not load questions");
      setQuestions(data?.questions ?? []);
    } catch {
      setQuestions([]);
    }
  }, [id]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    if (!user?.id) {
      setWishlistSaved(false);
      return;
    }
    supabase
      .from("wishlist_items")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", id)
      .maybeSingle()
      .then(({ data }) => setWishlistSaved(Boolean(data)));
  }, [id, user?.id]);

  useEffect(() => {
    setStockEmail(user?.email ?? "");
  }, [user?.email]);

  const productJsonLd = useMemo(() => {
    if (!product) return null;
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      image: product.images?.length ? product.images : [product.image],
      brand: { "@type": "Brand", name: product.brand },
      description: product.highlights.join(". "),
      sku: product.id,
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: product.rating,
        reviewCount: Math.max(product.reviews, reviews.length),
      },
      offers: {
        "@type": "Offer",
        priceCurrency: "INR",
        price: product.price,
        availability:
          product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: typeof window === "undefined" ? undefined : window.location.href,
        hasMerchantReturnPolicy: {
          "@type": "MerchantReturnPolicy",
          applicableCountry: "IN",
          returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
          merchantReturnDays: product.doa_policy_days ?? 7,
          returnMethod: "https://schema.org/ReturnByMail",
          returnFees: "https://schema.org/FreeReturn",
        },
      },
      additionalProperty: [
        {
          "@type": "PropertyValue",
          name: "Authenticity",
          value: gradeLabel(product.authenticity_grade ?? "compatible"),
        },
        {
          "@type": "PropertyValue",
          name: "Condition",
          value: gradeLabel(product.condition_grade ?? "new"),
        },
      ],
    };
  }, [product, reviews.length]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--background-base)]">
        <Header />
        <div className="grid place-items-center py-32">
          <Loader2 className="size-7 animate-spin text-[var(--heat-100)]" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[var(--background-base)]">
        <Header />
        <div className="container mx-auto px-4 py-24 text-center">
          <p className="text-label-small text-[var(--heat-100)]">Not found</p>
          <h1 className="mt-3 font-display text-title-h3 text-foreground">Product not found</h1>
          <Link
            to="/products"
            className="button button-primary mt-6 inline-flex h-10 items-center gap-2 rounded-md px-5 text-label-medium"
          >
            Back to catalog
          </Link>
        </div>
      </div>
    );
  }

  const related = allProducts
    .filter((item) => item.category === product.category && item.id !== product.id)
    .slice(0, 6);

  const addToCart = () => {
    cart.add(product.id, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const toggleWishlist = async () => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    setSavingAux("wishlist");
    try {
      const response = await fetch(`${apiBase}/wishlist${wishlistSaved ? `/${product.id}` : ""}`, {
        method: wishlistSaved ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthorizationHeaders()),
        },
        body: wishlistSaved ? undefined : JSON.stringify({ productId: product.id }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Wishlist update failed");
      setWishlistSaved(!wishlistSaved);
      toast.success(wishlistSaved ? "Removed from wishlist" : "Saved to wishlist");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Wishlist update failed");
    } finally {
      setSavingAux(null);
    }
  };

  const submitReview = async () => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (!reviewBody.trim()) {
      toast.error("Write a short review first");
      return;
    }
    setSavingAux("review");
    try {
      const response = await fetch(`${apiBase}/product-reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthorizationHeaders()),
        },
        body: JSON.stringify({
          productId: product.id,
          rating: reviewRating,
          body: reviewBody,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not submit review");
      setReviewBody("");
      setReviewRating(5);
      toast.success("Review posted");
      await loadReviews();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit review");
    } finally {
      setSavingAux(null);
    }
  };

  const submitStockAlert = async () => {
    if (!stockEmail.trim()) {
      toast.error("Add an email for the stock alert");
      return;
    }
    setSavingAux("stock");
    try {
      const response = await fetch(`${apiBase}/stock-notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthorizationHeaders()),
        },
        body: JSON.stringify({ productId: product.id, email: stockEmail }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save stock alert");
      toast.success("Stock alert saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save stock alert");
    } finally {
      setSavingAux(null);
    }
  };

  const submitQuestion = async () => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    const question = questionBody.trim();
    if (question.length < 3) {
      toast.error("Ask a specific product question first");
      return;
    }
    setSavingAux("question");
    try {
      const response = await fetch(`${apiBase}/product-questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthorizationHeaders()),
        },
        body: JSON.stringify({ productId: product.id, question }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not submit question");
      setQuestionBody("");
      toast.success("Question sent for admin answer");
      await loadQuestions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit question");
    } finally {
      setSavingAux(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background-base)]">
      <Header />
      <script type="application/ld+json">{JSON.stringify(productJsonLd)}</script>
      <div className="container mx-auto px-4 py-8">
        <nav className="text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
          <Link to="/" className="transition-colors hover:text-[var(--heat-100)]">
            home
          </Link>
          <span className="mx-2 text-[var(--black-alpha-24)]">/</span>
          <Link to="/products" className="transition-colors hover:text-[var(--heat-100)]">
            catalog
          </Link>
          <span className="mx-2 text-[var(--black-alpha-24)]">/</span>
          <span className="inline-block max-w-[280px] align-bottom text-[var(--heat-100)] line-clamp-1">
            {product.title}
          </span>
        </nav>

        <div className="mt-6 grid gap-10 md:grid-cols-[1fr_1.1fr] md:gap-14">
          <div className="space-y-4 md:sticky md:top-28 md:self-start">
            <div className="relative aspect-square overflow-hidden rounded-xl border border-[var(--border-muted)] bg-white">
              {discountPct(product) >= 30 && (
                <span className="absolute left-4 top-4 z-10 inline-flex items-center gap-1 rounded-sm bg-[var(--heat-100)] px-2.5 py-1 text-mono-x-small font-medium tracking-wide text-white shadow-[0_2px_8px_0_var(--heat-40)]">
                  -{discountPct(product)}% off
                </span>
              )}
              <img
                src={product.images?.[imageIndex] ?? product.image}
                alt={product.title}
                className="size-full object-contain p-10"
              />
            </div>

            {product.images && product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.images.map((imageUrl, index) => (
                  <button
                    key={imageUrl}
                    onClick={() => setImageIndex(index)}
                    className={`size-16 shrink-0 overflow-hidden rounded-md border bg-[var(--background-lighter)] transition-[border-color,opacity,box-shadow] ${
                      index === imageIndex
                        ? "border-[var(--heat-100)] ring-2 ring-[var(--heat-12)]"
                        : "border-[var(--border-faint)] opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={imageUrl} alt="" className="size-full object-contain p-1" />
                  </button>
                ))}
              </div>
            )}

            {isAdmin ? (
              <div className="grid gap-3 rounded-lg border border-[var(--border-muted)] bg-white p-4">
                <p className="text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
                  Admin session
                </p>
                <p className="text-body-small text-[var(--black-alpha-64)]">
                  Purchasing is disabled for admin accounts. Use the operations console to update
                  this listing, stock, pricing, and order flow.
                </p>
                <div className="flex gap-3">
                  <Link
                    to="/admin"
                    className="button button-primary inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-md text-label-medium"
                  >
                    Open admin console
                  </Link>
                  <Link
                    to="/products"
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] text-label-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
                  >
                    Back to catalog
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="flex gap-3">
                  <button
                    onClick={addToCart}
                    disabled={product.stock <= 0}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md border border-[var(--heat-100)] bg-white text-label-medium font-medium text-[var(--heat-100)] transition-[background-color,border-color,color] hover:bg-[var(--heat-4)]"
                  >
                    {added ? <Check className="size-4" /> : <ShoppingCart className="size-4" />}
                    {product.stock <= 0 ? "Out of stock" : added ? "Added" : "Add to cart"}
                  </button>
                  <button
                    onClick={() => {
                      cart.add(product.id, 1);
                      navigate({ to: "/cart" });
                    }}
                    disabled={product.stock <= 0}
                    className="button button-primary flex h-12 flex-1 items-center justify-center gap-2 rounded-md text-label-medium"
                  >
                    <Zap className="size-4 fill-current" /> Buy now
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleWishlist()}
                  disabled={savingAux === "wishlist"}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--border-muted)] bg-white text-label-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
                >
                  <Heart
                    className={`size-4 ${wishlistSaved ? "fill-[var(--heat-100)] text-[var(--heat-100)]" : ""}`}
                  />
                  {wishlistSaved ? "Saved to wishlist" : "Save for later"}
                </button>
                {product.stock <= 0 && (
                  <div className="grid gap-2 rounded-lg border border-[var(--border-muted)] bg-white p-4">
                    <p className="text-label-small text-foreground">Get stock alert</p>
                    <div className="flex gap-2">
                      <input
                        value={stockEmail}
                        onChange={(event) => setStockEmail(event.target.value)}
                        placeholder="Email"
                        className="h-10 min-w-0 flex-1 rounded-md border border-[var(--border-muted)] px-3 text-body-small"
                      />
                      <button
                        type="button"
                        onClick={() => void submitStockAlert()}
                        disabled={savingAux === "stock"}
                        className="button button-primary inline-flex h-10 items-center gap-2 rounded-md px-4 text-label-small"
                      >
                        <Bell className="size-4" />
                        Alert me
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-mono-x-small uppercase tracking-[0.18em] text-[var(--heat-100)]">
                {product.brand}
              </p>
              <h1 className="mt-2 text-balance font-display text-title-h3 leading-tight text-foreground">
                {product.title}
              </h1>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <span className="inline-flex items-center gap-1 text-body-large text-foreground">
                <Star className="size-4 fill-[var(--accent-honey)] text-[var(--accent-honey)]" />
                {product.rating.toFixed(1)}
              </span>
              <span className="text-mono-small text-[var(--black-alpha-48)]">
                {product.reviews.toLocaleString("en-IN")} ratings
              </span>
              <span className="size-1 rounded-full bg-[var(--accent-forest)]" />
              <span className="text-mono-x-small uppercase tracking-wider text-[var(--accent-forest)]">
                in stock
              </span>
            </div>

            <div className="flex items-baseline gap-4 border-b border-[var(--border-faint)] pb-6">
              <span className="font-display text-title-h2 text-foreground">
                {formatINR(product.price)}
              </span>
              <span className="text-body-large text-[var(--black-alpha-40)] line-through">
                {formatINR(product.mrp)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-sm bg-[var(--accent-forest)]/10 px-2 py-0.5 text-mono-small font-medium text-[var(--accent-forest)]">
                {discountPct(product)}% off
              </span>
            </div>
            <p className="-mt-3 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
              Inclusive of taxes / Free delivery on orders above {formatINR(999)}
            </p>

            <div>
              <h3 className="mb-3 text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
                Highlights
              </h3>
              <ul className="space-y-2.5">
                {product.highlights.map((highlight) => (
                  <li key={highlight} className="flex gap-3 text-body-medium text-foreground">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-[var(--heat-100)]" />
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-3 rounded-lg border border-[var(--border-muted)] bg-white p-5">
              <Row k="Compatibility" v={product.compatibility} />
              <Row k="Warranty" v={product.warranty} />
              <Row k="Authenticity" v={gradeLabel(product.authenticity_grade ?? "compatible")} />
              <Row k="Condition" v={gradeLabel(product.condition_grade ?? "new")} />
              <Row k="DOA policy" v={`${product.doa_policy_days ?? 7}-day DOA support`} />
              <Row
                k="Tax"
                v={`GST ${product.gst_rate ?? 18}%${product.hsn_code ? ` / HSN ${product.hsn_code}` : ""}`}
              />
              <Row
                k="COD"
                v={product.cod_eligible ? "Eligible under checkout policy" : "Prepaid only"}
              />
              <Row
                k="Stock"
                v={product.stock > 0 ? `${product.stock} units available` : "Out of stock"}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Truck, title: "Free delivery" },
                { icon: ShieldCheck, title: "Genuine product" },
                { icon: RotateCcw, title: `${product.doa_policy_days ?? 7}-day DOA` },
              ].map(({ icon: Icon, title }) => (
                <div
                  key={title}
                  className="flex flex-col items-center gap-2 rounded-lg border border-[var(--border-faint)] bg-white py-4 text-center"
                >
                  <Icon className="size-5 text-[var(--heat-100)]" strokeWidth={2.2} />
                  <span className="text-label-small text-foreground">{title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-20">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <span className="text-label-small text-[var(--heat-100)]">Also in catalog</span>
                <h2 className="mt-2 font-display text-title-h4 text-foreground">
                  Similar products
                </h2>
              </div>
              <Link
                to="/products"
                className="group inline-flex items-center gap-1 text-label-small text-foreground transition-colors hover:text-[var(--heat-100)]"
              >
                View all{" "}
                <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {related.map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} p={relatedProduct} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-16 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-lg border border-[var(--border-muted)] bg-white p-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-5 text-[var(--heat-100)]" />
              <h2 className="text-title-h5 text-foreground">Reviews</h2>
            </div>
            <p className="mt-2 text-body-small text-[var(--black-alpha-56)]">
              Share fit, compatibility, packing, and quality notes for other buyers.
            </p>
            {!isAdmin && (
              <div className="mt-5 space-y-3">
                <select
                  value={reviewRating}
                  onChange={(event) => setReviewRating(Number(event.target.value))}
                  className="h-10 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-small"
                >
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <option key={rating} value={rating}>
                      {rating} star{rating === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
                <textarea
                  value={reviewBody}
                  onChange={(event) => setReviewBody(event.target.value)}
                  rows={4}
                  placeholder="How was this part?"
                  className="w-full rounded-md border border-[var(--border-muted)] bg-white px-3 py-2 text-body-small"
                />
                <button
                  type="button"
                  onClick={() => void submitReview()}
                  disabled={savingAux === "review"}
                  className="button button-primary inline-flex h-10 items-center rounded-md px-4 text-label-small"
                >
                  {savingAux === "review" ? "Posting..." : "Post review"}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[var(--border-muted)] bg-white p-6">
            {reviews.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--border-muted)] p-8 text-center text-body-small text-[var(--black-alpha-56)]">
                No customer reviews yet.
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <article
                    key={review.id}
                    className="rounded-md border border-[var(--border-faint)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-label-small text-foreground">{review.rating}/5</p>
                      {review.verified_purchase && (
                        <span className="text-mono-x-small uppercase tracking-wider text-[var(--accent-forest)]">
                          verified purchase
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-body-small text-[var(--black-alpha-72)]">
                      {review.body}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-lg border border-[var(--border-muted)] bg-white p-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-5 text-[var(--heat-100)]" />
              <h2 className="text-title-h5 text-foreground">Questions</h2>
            </div>
            <p className="mt-2 text-body-small text-[var(--black-alpha-56)]">
              Ask about model fit, connectors, part numbers, stock condition, or packing.
            </p>
            {!isAdmin && (
              <div className="mt-5 space-y-3">
                <textarea
                  value={questionBody}
                  onChange={(event) => setQuestionBody(event.target.value)}
                  rows={4}
                  maxLength={800}
                  placeholder="Will this fit my laptop model?"
                  className="w-full rounded-md border border-[var(--border-muted)] bg-white px-3 py-2 text-body-small"
                />
                <button
                  type="button"
                  onClick={() => void submitQuestion()}
                  disabled={savingAux === "question"}
                  className="button button-primary inline-flex h-10 items-center rounded-md px-4 text-label-small"
                >
                  {savingAux === "question" ? "Sending..." : "Ask question"}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[var(--border-muted)] bg-white p-6">
            {questions.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--border-muted)] p-8 text-center text-body-small text-[var(--black-alpha-56)]">
                No answered questions yet.
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((question) => (
                  <article
                    key={question.id}
                    className="rounded-md border border-[var(--border-faint)] p-4"
                  >
                    <p className="text-label-small text-foreground">Q: {question.question}</p>
                    <p className="mt-3 text-body-small text-[var(--black-alpha-72)]">
                      A: {question.answer}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}

type ProductReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  verified_purchase: boolean;
  created_at: string;
};

type ProductQuestion = {
  id: string;
  question: string;
  answer: string | null;
  status: string;
  created_at: string;
  answered_at: string | null;
};

function gradeLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid gap-1 text-body-small sm:grid-cols-[140px_1fr] sm:gap-2">
      <span className="pt-0.5 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
        {k}
      </span>
      <span className="text-foreground">{v}</span>
    </div>
  );
}

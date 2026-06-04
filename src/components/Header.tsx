import { Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  ShoppingCart,
  User,
  LogOut,
  Package,
  ChevronDown,
  Flame,
  ShieldCheck,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCartState } from "@/lib/cart-store";
import { useAuth } from "@/lib/auth";

export function Header() {
  const { items, isHydrated: isCartHydrated } = useCartState();
  const count = items.reduce((sum, item) => sum + item.qty, 0);
  const { user, role, signOut } = useAuth();
  const isAdmin = role === "admin";
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    navigate({ to: "/products", search: trimmedQuery ? { q: trimmedQuery } : undefined });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-faint)] bg-white/95 backdrop-blur-xl">
      <div className="hidden border-b border-white/8 bg-[var(--accent-black)] text-white/75 md:block">
        <div className="container mx-auto flex items-center justify-between gap-6 px-4 py-2 text-mono-x-small">
          <span className="text-white/70">
            {isAdmin
              ? "Admin workspace for catalog, users, orders, and fulfillment"
              : "Free shipping on orders above Rs 999"}
          </span>
          <div className="flex items-center gap-5">
            <span className="text-white/55">
              {isAdmin ? "Backend-controlled operations" : "Genuine parts, fast dispatch"}
            </span>
            <Link
              to={isAdmin ? "/admin" : "/orders"}
              className="transition-colors hover:text-[var(--heat-100)]"
            >
              {isAdmin ? "Fulfillment queue" : "Track orders"}
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto flex items-center gap-4 px-4 py-3 sm:gap-8">
        <Link
          to={isAdmin ? "/admin" : "/"}
          aria-label={isAdmin ? "Open LapKart admin home" : "Open LapKart home"}
          className="group flex items-baseline gap-2"
        >
          <Flame
            className="size-5 -translate-y-px text-[var(--heat-100)] transition-transform group-hover:rotate-6"
            strokeWidth={2.4}
          />
          <div className="leading-none">
            <span className="font-display text-[22px] font-medium tracking-[-0.02em] text-foreground">
              lap<span className="text-[var(--heat-100)]">kart</span>
            </span>
            <span className="ml-1.5 text-mono-x-small text-[var(--black-alpha-40)]">
              {isAdmin ? "/ops" : "/parts"}
            </span>
          </div>
        </Link>

        <form onSubmit={submit} className="hidden max-w-[520px] flex-1 md:block">
          <label className="group flex h-11 items-center overflow-hidden rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] transition-[border-color,background-color,box-shadow] focus-within:border-[var(--heat-100)] focus-within:bg-white focus-within:shadow-[0_0_0_3px_var(--heat-12)]">
            <span className="sr-only">Search laptop parts</span>
            <Search className="ml-3 size-[15px] text-[var(--black-alpha-40)] transition-colors group-focus-within:text-[var(--heat-100)]" />
            <input
              type="search"
              name="q"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search laptop parts"
              placeholder={isAdmin ? "Search catalog preview" : "Search RAM, SSDs, batteries"}
              className="h-full flex-1 bg-transparent px-3 text-body-medium placeholder:text-[var(--black-alpha-48)]"
            />
          </label>
        </form>

        <nav className="ml-auto flex items-center gap-1 sm:gap-3">
          <Link
            to={isAdmin ? "/admin" : "/products"}
            className="hidden px-2 py-2 text-label-medium text-foreground/80 transition-colors hover:text-[var(--heat-100)] md:inline-flex md:min-h-11 md:items-center"
          >
            {isAdmin ? "Operations" : "Shop"}
          </Link>

          {user ? (
            <div ref={ref} className="relative">
              <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label={open ? "Close account menu" : "Open account menu"}
                className="flex min-h-11 items-center gap-2 rounded-md px-2.5 py-1.5 text-label-small text-foreground transition-colors hover:bg-[var(--black-alpha-4)]"
              >
                <div className="grid size-7 place-items-center rounded-full bg-[var(--heat-100)] text-mono-small font-medium text-white">
                  {(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}
                </div>
                <span className="hidden max-w-[100px] truncate sm:inline">
                  {(user.user_metadata?.full_name || user.email)?.split(" ")[0]?.split("@")[0]}
                </span>
                <ChevronDown className="size-3 text-[var(--black-alpha-40)]" />
              </button>

              <AnimatePresence>
                {open && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.16, ease: [0.25, 0.1, 0.25, 1] }}
                    className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-lg border border-[var(--border-muted)] bg-white shadow-[var(--shadow-pop)]"
                  >
                    <div className="border-b border-[var(--border-faint)] px-4 py-3">
                      <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                        Signed in
                      </p>
                      <p className="mt-0.5 truncate text-label-small text-foreground">
                        {user.email}
                      </p>
                    </div>
                    {isAdmin ? (
                      <>
                        <MenuItem
                          to="/admin"
                          icon={ShieldCheck}
                          label="Admin dashboard"
                          onClick={() => setOpen(false)}
                        />
                        <MenuItem
                          to="/products"
                          icon={Package}
                          label="Storefront preview"
                          onClick={() => setOpen(false)}
                        />
                      </>
                    ) : (
                      <>
                        <MenuItem
                          to="/orders"
                          icon={Package}
                          label="My orders"
                          onClick={() => setOpen(false)}
                        />
                        <MenuItem
                          to="/dashboard"
                          icon={Package}
                          label="Customer dashboard"
                          onClick={() => setOpen(false)}
                        />
                      </>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={async () => {
                        setOpen(false);
                        await signOut();
                        navigate({ to: "/" });
                      }}
                      className="flex w-full items-center gap-3 border-t border-[var(--border-faint)] px-4 py-2.5 text-label-small text-[var(--accent-crimson)] transition-colors hover:bg-[var(--heat-4)]"
                    >
                      <LogOut className="size-[15px]" /> Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link
              to="/login"
              aria-label="Sign in to LapKart"
              className="flex min-h-11 items-center gap-1.5 rounded-md border border-[var(--border-muted)] bg-white px-3 py-1.5 text-label-small text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
            >
              <User className="size-4" />
              <span className="hidden sm:inline">Login</span>
            </Link>
          )}

          {!isAdmin && (
            <Link
              to="/cart"
              aria-label={count > 0 ? `Open cart with ${count} items` : "Open cart"}
              className="relative flex min-h-11 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-label-small text-foreground transition-colors hover:bg-[var(--black-alpha-4)]"
            >
              <ShoppingCart className="size-[18px]" />
              <span className="hidden sm:inline">Cart</span>
              {isCartHydrated && count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 520, damping: 18 }}
                  className="absolute -right-0.5 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--heat-100)] px-1 text-[10px] font-medium text-white shadow-[0_2px_4px_0_var(--heat-40)]"
                >
                  {count}
                </motion.span>
              )}
            </Link>
          )}
        </nav>
      </div>

      <div className="border-t border-[var(--border-faint)] md:hidden">
        <form onSubmit={submit} className="container mx-auto px-4 py-2.5">
          <label className="flex h-11 items-center overflow-hidden rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] focus-within:border-[var(--heat-100)] focus-within:shadow-[0_0_0_3px_var(--heat-12)]">
            <span className="sr-only">Search laptop parts</span>
            <Search className="ml-3 size-[15px] text-[var(--black-alpha-40)]" />
            <input
              type="search"
              name="q"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search laptop parts"
              placeholder={isAdmin ? "Search catalog" : "Search parts"}
              className="h-full flex-1 bg-transparent px-3 text-body-medium placeholder:text-[var(--black-alpha-48)]"
            />
          </label>
        </form>
      </div>
    </header>
  );
}

function MenuItem({
  to,
  icon: Icon,
  label,
  onClick,
}: {
  to: string;
  icon: typeof Package;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 text-label-small text-foreground transition-colors hover:bg-[var(--heat-4)] hover:text-[var(--heat-100)]"
    >
      <Icon className="size-[15px] text-[var(--black-alpha-48)]" /> {label}
    </Link>
  );
}

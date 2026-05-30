import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { AiChat } from "@/components/AiChat";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background-base)] px-4">
      <div className="max-w-md text-center">
        <span className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-100)]">
          404 / not_found
        </span>
        <h1 className="mt-2 font-display text-[88px] leading-none font-medium text-foreground tracking-tighter">
          4<span className="text-gradient-heat">0</span>4
        </h1>
        <h2 className="mt-4 font-display text-title-h4 text-foreground">Page not found</h2>
        <p className="mt-2 text-body-medium text-[var(--black-alpha-56)]">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="button button-primary mt-6 inline-flex items-center gap-2 rounded-md px-5 h-11 text-label-medium"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background-base)] px-4">
      <div className="max-w-md text-center">
        <span className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--accent-crimson)]">
          500 / error
        </span>
        <h1 className="mt-2 font-display text-title-h3 text-foreground">This page didn't load</h1>
        <p className="mt-3 text-body-medium text-[var(--black-alpha-56)]">
          Something went wrong on our end. Try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="button button-primary inline-flex items-center gap-2 rounded-md px-5 h-11 text-label-medium"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-md border border-[var(--border-muted)] bg-white px-5 h-11 text-label-medium text-foreground hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] transition-colors"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "LapKart" },
      { name: "description", content: "**LapKart** is a smart e-commerce platform for laptop spare parts and hardware components. Users can easily search, compare, and purchase compatible laptop part" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "LapKart" },
      { property: "og:description", content: "**LapKart** is a smart e-commerce platform for laptop spare parts and hardware components. Users can easily search, compare, and purchase compatible laptop part" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "LapKart" },
      { name: "twitter:description", content: "**LapKart** is a smart e-commerce platform for laptop spare parts and hardware components. Users can easily search, compare, and purchase compatible laptop part" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/51bd8745-2111-4d21-b5d7-4796ae6a3c2a/id-preview-e0366819--46d13f7e-33f4-4eb6-870b-7b970604b19c.lovable.app-1778983816158.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/51bd8745-2111-4d21-b5d7-4796ae6a3c2a/id-preview-e0366819--46d13f7e-33f4-4eb6-870b-7b970604b19c.lovable.app-1778983816158.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <AiChat />
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

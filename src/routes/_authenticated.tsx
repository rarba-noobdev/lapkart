import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  component: Guard,
});

function Guard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login", search: { redirect: loc.pathname } });
    }
  }, [user, loading, navigate, loc.pathname]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--background-base)]">
        <Loader2 className="size-7 animate-spin text-[var(--heat-100)]" />
      </div>
    );
  }
  return <Outlet />;
}

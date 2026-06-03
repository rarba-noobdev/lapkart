import { useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type RealtimeTable =
  | "addresses"
  | "orders"
  | "order_items"
  | "payments"
  | "products"
  | "profiles"
  | "shipments"
  | "shipping_pickup_locations"
  | "shipment_events";

type RealtimeTarget = {
  table: RealtimeTable;
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
  filter?: string;
};

type UseRealtimeRefreshOptions = {
  channelName: string;
  enabled?: boolean;
  onRefresh: () => void | Promise<void>;
  targets: RealtimeTarget[];
  debounceMs?: number;
};

export function useRealtimeRefresh({
  channelName,
  enabled = true,
  onRefresh,
  targets,
  debounceMs = 180,
}: UseRealtimeRefreshOptions) {
  const refreshRef = useRef(onRefresh);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  const signature = useMemo(
    () =>
      JSON.stringify(
        targets.map((target) => ({
          event: target.event ?? "*",
          table: target.table,
          filter: target.filter ?? null,
        })),
      ),
    [targets],
  );

  useEffect(() => {
    if (!enabled || targets.length === 0) return undefined;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        void refreshRef.current();
      }, debounceMs);
    };

    const channel = supabase.channel(channelName);
    for (const target of targets) {
      channel.on(
        "postgres_changes",
        {
          event: target.event ?? "*",
          schema: "public",
          table: target.table,
          filter: target.filter,
        },
        scheduleRefresh,
      );
    }

    channel.subscribe();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      void supabase.removeChannel(channel);
    };
  }, [channelName, debounceMs, enabled, signature, targets]);
}

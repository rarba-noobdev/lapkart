import { useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type RealtimeTable =
  | "addresses"
  | "coupon_redemptions"
  | "coupons"
  | "order_cancellation_requests"
  | "order_invoices"
  | "orders"
  | "order_items"
  | "payments"
  | "business_accounts"
  | "product_questions"
  | "products"
  | "profiles"
  | "refunds"
  | "return_requests"
  | "shipments"
  | "shipping_pickup_locations"
  | "stock_notification_events"
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

  const subscribedTargets = useMemo(() => {
    return JSON.parse(signature) as Array<{
      event: RealtimeTarget["event"] | null;
      table: RealtimeTarget["table"];
      filter: string | null;
    }>;
  }, [signature]);

  useEffect(() => {
    if (!enabled || subscribedTargets.length === 0) return undefined;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        void refreshRef.current();
      }, debounceMs);
    };

    const channel = supabase.channel(channelName);
    for (const target of subscribedTargets) {
      channel.on(
        "postgres_changes",
        {
          event: target.event ?? "*",
          schema: "public",
          table: target.table,
          filter: target.filter ?? undefined,
        },
        scheduleRefresh,
      );
    }

    channel.subscribe((status, error) => {
      if (error) {
        console.error(`[Realtime] ${channelName} subscription failed`, status, error);
      }
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      void supabase.removeChannel(channel);
    };
  }, [channelName, debounceMs, enabled, subscribedTargets]);
}

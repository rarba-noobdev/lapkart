import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

/* ─── Table registry ──────────────────────────────────────────────── */

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

type ChannelStatus = "CLOSED" | "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT";

/* ─── Postgres Changes subscription ───────────────────────────────── */

export function useRealtimeRefresh({
  channelName,
  enabled = true,
  onRefresh,
  targets,
  debounceMs = 180,
}: UseRealtimeRefreshOptions) {
  const refreshRef = useRef(onRefresh);
  const [status, setStatus] = useState<ChannelStatus>("CLOSED");

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  const signature = useMemo(
    () =>
      JSON.stringify(
        targets.map((t) => ({
          event: t.event ?? "*",
          table: t.table,
          filter: t.filter ?? null,
        })),
      ),
    [targets],
  );

  const subscribedTargets = useMemo<RealtimeTarget[]>(() => JSON.parse(signature), [signature]);

  useEffect(() => {
    if (!enabled || subscribedTargets.length === 0) return;

    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void refreshRef.current(), debounceMs);
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
        (_payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          scheduleRefresh();
        },
      );
    }

    channel.subscribe((statusCode: ChannelStatus, err?: Error) => {
      setStatus(statusCode);
      if (statusCode === "CHANNEL_ERROR" || err) {
        console.error(`[Realtime] Channel "${channelName}" error:`, statusCode, err?.message ?? "");
      }
    });

    return () => {
      if (debounce) clearTimeout(debounce);
      setStatus("CLOSED");
      void supabase.removeChannel(channel);
    };
  }, [channelName, debounceMs, enabled, subscribedTargets]);

  return { status };
}

/* ─── Broadcast (client-to-client messages) ───────────────────────── */

type BroadcastEvent = "notification" | "admin_action" | "order_update" | "invalidate_cache";

type BroadcastPayload = {
  event: BroadcastEvent;
  label: string;
  detail?: string;
  timestamp: number;
};

/**
 * Subscribe to broadcast messages from other clients on the same channel.
 * Returns a send function to emit messages.
 */
export function useBroadcast(channelName: string, onMessage?: (msg: BroadcastPayload) => void) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const send = useCallback((event: BroadcastEvent, label: string, detail?: string) => {
    const payload: BroadcastPayload = { event, label, detail, timestamp: Date.now() };
    channelRef.current?.send({
      type: "broadcast",
      event: "notification",
      payload,
    });
  }, []);

  useEffect(() => {
    const channel = supabase.channel(channelName, {
      config: { broadcast: { ack: false, self: false } },
    });

    channel.on("broadcast", { event: "notification" }, (payload: { payload: BroadcastPayload }) => {
      onMessage?.(payload.payload);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [channelName, onMessage]);

  return { send };
}

/* ─── Presence (online users / cursors) ───────────────────────────── */

type PresenceState = {
  userId: string;
  email: string;
  name: string;
  onlineAt: number;
};

/**
 * Track user presence on a channel. Returns the set of currently tracking users.
 */
export function usePresence(
  channelName: string,
  user: { id: string; email: string; name: string },
) {
  const [users, setUsers] = useState<Map<string, PresenceState>>(new Map());

  useEffect(() => {
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: user.id },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const newState = channel.presenceState<PresenceState>();
        const map = new Map<string, PresenceState>();
        for (const [key, states] of Object.entries(newState)) {
          if (states.length > 0) {
            map.set(key, states[states.length - 1]);
          }
        }
        setUsers(map);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        setUsers((prev) => {
          const next = new Map(prev);
          for (const p of newPresences) {
            next.set(key, p as PresenceState);
          }
          return next;
        });
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        setUsers((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          userId: user.id,
          email: user.email,
          name: user.name,
          onlineAt: Date.now(),
        } satisfies PresenceState);
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, user.id, user.email, user.name]);

  return { users: Array.from(users.values()) };
}

import { useEffect, useState } from "react";

/**
 * SmartTime — Baymard best practice: show relative timestamps
 * "2h ago", "yesterday", "just now" with full date on hover tooltip
 * Auto-refreshes every 60s so timestamps stay current.
 */
export function SmartTime({
  date,
  showFull = false,
}: {
  date: string | Date | null | undefined;
  showFull?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const d = typeof date === "string" ? new Date(date) : date;
  if (!date || !d || Number.isNaN(d.getTime())) {
    return <>{showFull ? "—" : ""}</>;
  }

  const title = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(d);

  if (!mounted || showFull) {
    return (
      <time dateTime={d.toISOString()} title={title}>
        {title}
      </time>
    );
  }

  const diff = Date.now() - d.getTime();
  let text: string;
  if (diff < 0) text = "just now";
  else if (diff < 30_000) text = "just now";
  else if (diff < 60_000) text = `${Math.floor(diff / 1000)}s ago`;
  else if (diff < 3_600_000) text = `${Math.floor(diff / 60_000)}m ago`;
  else if (diff < 86_400_000) text = `${Math.floor(diff / 3_600_000)}h ago`;
  else {
    const days = Math.floor(diff / 86_400_000);
    text = days === 1 ? "yesterday" : `${days}d ago`;
  }

  return <time title={showFull ? "" : title}>{showFull ? title : text}</time>;
}

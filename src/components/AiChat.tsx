import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, Flame } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { aiChat } from "@/lib/ai.functions";

type Msg = { role: "user" | "assistant"; content: string };

export function AiChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi — I'm lapkart's parts assistant. Tell me your laptop model and I'll find compatible RAM, SSDs, batteries or repair parts.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const chat = useServerFn(aiChat);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const { reply } = await chat({ data: { messages: next.map((m) => ({ role: m.role, content: m.content })) } });
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Sorry — I hit an error. Try again." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen((o) => !o)}
        className="button button-primary fixed bottom-5 right-5 z-50 grid size-14 place-items-center rounded-full"
        aria-label="Parts assistant"
      >
        {open ? <X className="size-5" /> : <Flame className="size-5" strokeWidth={2.4} />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-24 right-5 z-50 flex h-[30rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-xl border border-[var(--border-muted)] bg-white shadow-[var(--shadow-pop)]"
          >
            {/* Header */}
            <div className="relative flex items-center gap-3 bg-[var(--accent-black)] px-5 py-4 text-white overflow-hidden">
              <div className="pointer-events-none absolute -top-16 -right-10 h-32 w-32 rounded-full bg-[var(--heat-100)] opacity-30 blur-2xl" />
              <div className="relative grid size-9 place-items-center rounded-md bg-[var(--heat-100)] shadow-[0_2px_8px_0_var(--heat-40)]">
                <Flame className="size-4" strokeWidth={2.4} />
              </div>
              <div className="relative flex-1">
                <p className="text-label-small text-white">parts.assistant</p>
                <p className="text-mono-x-small uppercase tracking-[0.16em] text-white/50">
                  <span className="text-[var(--accent-forest)]">●</span>&nbsp;online · ai-powered
                </p>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[var(--background-lighter)] px-4 py-4">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <span className="mr-2 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[var(--heat-100)] text-white">
                      <Flame className="size-3" strokeWidth={2.6} />
                    </span>
                  )}
                  <div
                    className={`max-w-[78%] whitespace-pre-wrap rounded-lg px-3 py-2 text-body-small leading-relaxed ${
                      m.role === "user"
                        ? "button-primary text-white"
                        : "bg-white text-foreground border border-[var(--border-faint)]"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start items-center gap-2">
                  <span className="mr-1 grid size-6 place-items-center rounded-full bg-[var(--heat-100)] text-white">
                    <Flame className="size-3" strokeWidth={2.6} />
                  </span>
                  <div className="rounded-lg border border-[var(--border-faint)] bg-white px-3 py-2">
                    <Loader2 className="size-3.5 animate-spin text-[var(--heat-100)]" />
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={send} className="flex gap-2 border-t border-[var(--border-faint)] bg-white p-2.5">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about compatible parts…"
                className="flex-1 rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] px-3 py-2 text-body-small outline-none focus:border-[var(--heat-100)] focus:bg-white transition-colors"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="button button-primary grid size-10 place-items-center rounded-md disabled:opacity-40"
              >
                <Send className="size-[15px]" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

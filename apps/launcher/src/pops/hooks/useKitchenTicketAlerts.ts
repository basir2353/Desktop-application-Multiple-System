import type { KitchenTicket } from "@platform/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { playKitchenBell, ticketAttentionFingerprint } from "../lib/kitchenBell";

export type KitchenAttentionKind = "new" | "updated";

const HIGHLIGHT_MS = 90_000;

/**
 * Watch active kitchen tickets: ring a loud bell and yellow-highlight on
 * new tickets or content updates (qty / items / station / priority).
 */
export function useKitchenTicketAlerts(tickets: KitchenTicket[], enabled: boolean): {
  attention: Map<string, KitchenAttentionKind>;
  clearAttention: (ticketId: string) => void;
  clearAllAttention: () => void;
  soundEnabled: boolean;
  setSoundEnabled: (on: boolean) => void;
} {
  const [attention, setAttention] = useState<Map<string, KitchenAttentionKind>>(() => new Map());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevFpRef = useRef<Map<string, string>>(new Map());
  const seededRef = useRef(false);
  const clearTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const clearAttention = useCallback((ticketId: string) => {
    const existing = clearTimersRef.current.get(ticketId);
    if (existing) {
      clearTimeout(existing);
      clearTimersRef.current.delete(ticketId);
    }
    setAttention((prev) => {
      if (!prev.has(ticketId)) return prev;
      const next = new Map(prev);
      next.delete(ticketId);
      return next;
    });
  }, []);

  const clearAllAttention = useCallback(() => {
    for (const timer of clearTimersRef.current.values()) clearTimeout(timer);
    clearTimersRef.current.clear();
    setAttention(new Map());
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of clearTimersRef.current.values()) clearTimeout(timer);
      clearTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      seededRef.current = false;
      prevFpRef.current = new Map();
      return;
    }

    const nextFp = new Map<string, string>();
    for (const ticket of tickets) {
      if (ticket.status === "done") continue;
      nextFp.set(ticket.id, ticketAttentionFingerprint(ticket));
    }

    if (!seededRef.current) {
      prevFpRef.current = nextFp;
      seededRef.current = true;
      return;
    }

    const prev = prevFpRef.current;
    const events: Array<{ id: string; kind: KitchenAttentionKind }> = [];

    for (const [id, fp] of nextFp) {
      const was = prev.get(id);
      if (was == null) {
        events.push({ id, kind: "new" });
      } else if (was !== fp) {
        events.push({ id, kind: "updated" });
      }
    }

    prevFpRef.current = nextFp;
    if (events.length === 0) return;

    setAttention((prevMap) => {
      const next = new Map(prevMap);
      for (const ev of events) next.set(ev.id, ev.kind);
      return next;
    });

    for (const ev of events) {
      const existing = clearTimersRef.current.get(ev.id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        clearTimersRef.current.delete(ev.id);
        setAttention((prev) => {
          if (!prev.has(ev.id)) return prev;
          const next = new Map(prev);
          next.delete(ev.id);
          return next;
        });
      }, HIGHLIGHT_MS);
      clearTimersRef.current.set(ev.id, timer);
    }

    if (soundEnabledRef.current) {
      void playKitchenBell();
    }
  }, [tickets, enabled]);

  return {
    attention,
    clearAttention,
    clearAllAttention,
    soundEnabled,
    setSoundEnabled,
  };
}

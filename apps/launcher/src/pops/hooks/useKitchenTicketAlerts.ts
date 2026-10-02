import type { KitchenTicket } from "@platform/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { playKitchenBell, ticketAttentionFingerprint } from "../lib/kitchenBell";

export type KitchenAttentionKind = "new" | "updated";

const HIGHLIGHT_MS = 90_000;

/**
 * Watch active kitchen tickets: ring a loud bell and yellow-highlight on
 * new tickets or content updates (qty / items / station / priority).
 *
 * Same order + same content never rings again on refresh — only real changes.
 */
export function useKitchenTicketAlerts(
  tickets: KitchenTicket[],
  enabled: boolean,
  /** Reset memory when branch changes. */
  scopeKey = "",
): {
  attention: Map<string, KitchenAttentionKind>;
  clearAttention: (ticketId: string) => void;
  clearAllAttention: () => void;
  soundEnabled: boolean;
  setSoundEnabled: (on: boolean) => void;
} {
  const [attention, setAttention] = useState<Map<string, KitchenAttentionKind>>(() => new Map());
  const [soundEnabled, setSoundEnabled] = useState(true);
  /** Last fingerprint we already alerted for (sound + highlight). Survives empty refresh frames. */
  const alertedFpRef = useRef<Map<string, string>>(new Map());
  const seededRef = useRef(false);
  const scopeRef = useRef(scopeKey);
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

  // Branch / scope change → fresh baseline (no bell for existing tickets).
  useEffect(() => {
    if (scopeRef.current === scopeKey) return;
    scopeRef.current = scopeKey;
    seededRef.current = false;
    alertedFpRef.current = new Map();
    clearAllAttention();
  }, [scopeKey, clearAllAttention]);

  useEffect(() => {
    if (!enabled) return;

    // Ignore empty frames during refetch — do NOT wipe alert memory or every
    // active ticket will look "new" when data returns and the bell loops.
    if (tickets.length === 0) {
      if (!seededRef.current) {
        seededRef.current = true;
      }
      return;
    }

    const nextFp = new Map<string, string>();
    for (const ticket of tickets) {
      if (ticket.status === "done") continue;
      nextFp.set(ticket.id, ticketAttentionFingerprint(ticket));
    }

    if (!seededRef.current) {
      alertedFpRef.current = new Map(nextFp);
      seededRef.current = true;
      return;
    }

    const events: Array<{ id: string; kind: KitchenAttentionKind }> = [];

    for (const [id, fp] of nextFp) {
      const alreadyAlertedFor = alertedFpRef.current.get(id);
      // Same content we already rang for → skip (refresh must stay silent).
      if (alreadyAlertedFor === fp) continue;

      if (alreadyAlertedFor == null) {
        events.push({ id, kind: "new" });
      } else {
        events.push({ id, kind: "updated" });
      }
      alertedFpRef.current.set(id, fp);
    }

    // Drop memory for tickets that left the active board (completed / gone).
    for (const id of [...alertedFpRef.current.keys()]) {
      if (!nextFp.has(id)) alertedFpRef.current.delete(id);
    }

    if (events.length === 0) return;

    setAttention((prevMap) => {
      const next = new Map(prevMap);
      for (const ev of events) next.set(ev.id, ev.kind);
      return next;
    });

    for (const ev of events) {
      // Updated rows stay yellow until kitchen Accept (or Clear) — not auto-timed out.
      if (ev.kind === "updated") {
        const existing = clearTimersRef.current.get(ev.id);
        if (existing) {
          clearTimeout(existing);
          clearTimersRef.current.delete(ev.id);
        }
        continue;
      }
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

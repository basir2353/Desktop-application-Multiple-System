import { useCallback, useMemo, useState } from "react";
import { usePopsStore } from "../../stores/popsStore";
import { loadMobizoneDb, type MobizoneDb } from "../lib/mobizoneStore";

export function useMobizoneBranchCode(): string | null {
  return usePopsStore((s) => s.branch?.code ?? null);
}

/** Local-store snapshot with a simple refresh counter. */
export function useMobizoneDb(): {
  branchCode: string | null;
  db: MobizoneDb;
  refresh: () => void;
} {
  const branchCode = useMobizoneBranchCode();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const db = useMemo((): MobizoneDb => {
    void tick;
    if (!branchCode) {
      return {
        customers: [],
        devices: [],
        sales: [],
        purchases: [],
        bankAccounts: [],
        shopkeepers: [],
        ledger: [],
        expenses: [],
        expenseAccounts: [],
        vouchers: [],
      };
    }
    return loadMobizoneDb(branchCode);
  }, [branchCode, tick]);
  return { branchCode, db, refresh };
}

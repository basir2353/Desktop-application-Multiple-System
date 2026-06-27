import { useMemo, useState } from "react";
import {
  formatPeriodLabel,
  nowLocal,
  presetRange,
  startOfMonthLocal,
  toIsoRange,
  type ReportDatePreset,
} from "../lib/reportDateFilter";

const ALL_TIME_FROM = "2000-01-01T00:00";

export function useStoreReportDateFilter(initialPreset: ReportDatePreset = "month") {
  const initial = presetRange(initialPreset);
  const [fromLocal, setFromLocal] = useState(initial.from || startOfMonthLocal());
  const [toLocal, setToLocal] = useState(initial.to || nowLocal());
  const [appliedFrom, setAppliedFrom] = useState(fromLocal);
  const [appliedTo, setAppliedTo] = useState(toLocal);

  const { fromIso, toIso } = useMemo(() => toIsoRange(appliedFrom, appliedTo), [appliedFrom, appliedTo]);

  const periodLabel = useMemo(() => {
    if (appliedFrom === ALL_TIME_FROM) return "All time";
    return formatPeriodLabel(appliedFrom, appliedTo);
  }, [appliedFrom, appliedTo]);

  function applyFilter(): void {
    setAppliedFrom(fromLocal);
    setAppliedTo(toLocal);
  }

  function applyPreset(preset: ReportDatePreset): void {
    const { from, to } = presetRange(preset);
    if (preset === "all") {
      const allTo = nowLocal();
      setFromLocal(ALL_TIME_FROM);
      setToLocal(allTo);
      setAppliedFrom(ALL_TIME_FROM);
      setAppliedTo(allTo);
      return;
    }
    setFromLocal(from);
    setToLocal(to);
    setAppliedFrom(from);
    setAppliedTo(to);
  }

  return {
    fromLocal,
    setFromLocal,
    toLocal,
    setToLocal,
    appliedFrom,
    appliedTo,
    fromIso,
    toIso,
    periodLabel,
    applyFilter,
    applyPreset,
  };
}

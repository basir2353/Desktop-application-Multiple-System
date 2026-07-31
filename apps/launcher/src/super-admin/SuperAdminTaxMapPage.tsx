import { Button } from "@platform/ui";
import { SYSTEM_TYPE_LABELS } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPlatformBusinesses, updatePlatformBusiness } from "../lib/platformApi";
import { headingClass, mutedClass } from "../pops/lib/themeClasses";
import { resolvePraFlags } from "./superAdminHelpers";

export function SuperAdminTaxMapPage(): JSX.Element {
  const qc = useQueryClient();
  const businesses = useQuery({
    queryKey: ["platform", "businesses"],
    queryFn: fetchPlatformBusinesses,
  });
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (businesses.data ?? []).filter(
      (b) =>
        !q ||
        b.name.toLowerCase().includes(q) ||
        (b.adminEmail ?? "").toLowerCase().includes(q),
    );
  }, [businesses.data, filter]);

  const saveMut = useMutation({
    mutationFn: (args: {
      id: string;
      fbrEnabled: boolean;
      praFakeEnabled: boolean;
      praRealEnabled: boolean;
    }) =>
      updatePlatformBusiness(args.id, {
        fbrEnabled: args.fbrEnabled,
        praFakeEnabled: args.praFakeEnabled,
        praRealEnabled: args.praRealEnabled,
      }),
    onSuccess: async (saved) => {
      const pra = resolvePraFlags(saved);
      setMessage(
        `${saved.name}: FBR ${saved.fbrEnabled ? "ON" : "OFF"} · FPRA ${pra.praFakeEnabled ? "ON" : "OFF"} · Real PRA ${pra.praRealEnabled ? "ON" : "OFF"}`,
      );
      await qc.invalidateQueries({ queryKey: ["platform", "businesses"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const list = businesses.data ?? [];
  const fbrOn = list.filter((b) => b.fbrEnabled).length;
  const praFakeOn = list.filter((b) => resolvePraFlags(b).praFakeEnabled).length;
  const praRealOn = list.filter((b) => resolvePraFlags(b).praRealEnabled).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-lg font-semibold ${headingClass}`}>FBR / FPRA / Real PRA</h2>
        <p className={`mt-1 text-sm ${mutedClass}`}>
          Enable FBR / FPRA / Real PRA per business. Admins see Tax &amp; compliance after
          refresh / re-login. FPRA = demo fiscal slip; Real PRA = live e-IMS.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Businesses" value={list.length} />
        <Stat label="FBR on" value={fbrOn} />
        <Stat label="FPRA on" value={praFakeOn} />
        <Stat label="Real PRA on" value={praRealOn} />
      </div>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by name or admin email…"
        className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
      />

      {message ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3 font-medium">Business</th>
              <th className="px-4 py-3 font-medium">FBR</th>
              <th className="px-4 py-3 font-medium">FPRA</th>
              <th className="px-4 py-3 font-medium">Real PRA</th>
              <th className="px-4 py-3 font-medium">Save</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((b) => {
              const pra = resolvePraFlags(b);
              return (
                <TaxRow
                  key={b.id}
                  id={b.id}
                  name={b.name}
                  systemType={b.systemType}
                  fbr={Boolean(b.fbrEnabled)}
                  praFake={pra.praFakeEnabled}
                  praReal={pra.praRealEnabled}
                  busy={saveMut.isPending}
                  onSave={(fbrEnabled, praFakeEnabled, praRealEnabled) =>
                    saveMut.mutate({ id: b.id, fbrEnabled, praFakeEnabled, praRealEnabled })
                  }
                />
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className={`px-4 py-8 text-sm ${mutedClass}`}>
                  No businesses match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TaxRow({
  id,
  name,
  systemType,
  fbr,
  praFake,
  praReal,
  busy,
  onSave,
}: {
  id: string;
  name: string;
  systemType: keyof typeof SYSTEM_TYPE_LABELS;
  fbr: boolean;
  praFake: boolean;
  praReal: boolean;
  busy: boolean;
  onSave: (fbr: boolean, praFake: boolean, praReal: boolean) => void;
}): JSX.Element {
  const [fbrEnabled, setFbr] = useState(fbr);
  const [praFakeEnabled, setPraFake] = useState(praFake);
  const [praRealEnabled, setPraReal] = useState(praReal);

  useEffect(() => {
    setFbr(fbr);
    setPraFake(praFake);
    setPraReal(praReal);
  }, [fbr, praFake, praReal]);

  const dirty =
    fbrEnabled !== fbr || praFakeEnabled !== praFake || praRealEnabled !== praReal;

  return (
    <tr>
      <td className="px-4 py-3">
        <Link
          to={`/super-admin/businesses/${id}`}
          className="font-medium text-amber-700 hover:underline dark:text-amber-400"
        >
          {name}
        </Link>
        <p className={`text-xs ${mutedClass}`}>{SYSTEM_TYPE_LABELS[systemType]}</p>
      </td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={fbrEnabled}
          onChange={(e) => setFbr(e.target.checked)}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={praFakeEnabled}
          onChange={(e) => {
            setPraFake(e.target.checked);
          }}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={praRealEnabled}
          onChange={(e) => {
            setPraReal(e.target.checked);
          }}
        />
      </td>
      <td className="px-4 py-3">
        <Button
          type="button"
          disabled={!dirty || busy}
          onClick={() => onSave(fbrEnabled, praFakeEnabled, praRealEnabled)}
        >
          Save
        </Button>
      </td>
    </tr>
  );
}

function Stat({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

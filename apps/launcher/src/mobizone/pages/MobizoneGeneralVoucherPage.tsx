import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";
import { mutedClass } from "../../pops/lib/themeClasses";
import { useSessionStore } from "../../stores/sessionStore";
import { useMobizoneDb } from "../hooks/useMobizone";
import { canEditMobizoneBillDate } from "../lib/mobizoneAccess";
import {
  filterByDateRange,
  formatPkr,
  monthStartDateInput,
  recordGeneralVoucher,
  seedExpenseAccounts,
  todayDateInput,
  type GeneralVoucherLineInput,
} from "../lib/mobizoneStore";
import {
  MzDateRangeFilter,
  MzDocumentLinks,
  MzDocumentUpload,
  MzField,
  MzInput,
  MzPage,
  MzPrimaryButton,
  MzSecondaryButton,
  MzSection,
  MzSelect,
  MzStickyActions,
  MzTextArea,
  type MzDocumentFile,
} from "../ui/MobizoneUi";

type LineDraft = {
  accountKind: GeneralVoucherLineInput["accountKind"];
  accountId: string;
  side: "debit" | "credit";
  amount: string;
};

const emptyLine = (side: "debit" | "credit"): LineDraft => ({
  accountKind: "customer",
  accountId: "",
  side,
  amount: "",
});

export function MobizoneGeneralVoucherPage(): JSX.Element {
  const { branchCode, db, refresh } = useMobizoneDb();
  const claims = useSessionStore((s) => s.claims);
  const canSetDate = canEditMobizoneBillDate(claims);

  const [entryDate, setEntryDate] = useState(todayDateInput);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<MzDocumentFile[]>([]);
  const [fromDate, setFromDate] = useState(monthStartDateInput);
  const [toDate, setToDate] = useState(todayDateInput);
  const [lines, setLines] = useState<LineDraft[]>([emptyLine("debit"), emptyLine("credit")]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!branchCode) return;
    seedExpenseAccounts(branchCode);
    refresh();
  }, [branchCode, refresh]);

  const history = useMemo(
    () =>
      filterByDateRange(
        (db.vouchers ?? []).filter((v) => v.kind === "general"),
        fromDate || null,
        toDate || null,
      ),
    [db.vouchers, fromDate, toDate],
  );

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const l of lines) {
      const n = Number(l.amount) || 0;
      if (l.side === "debit") debit += n;
      else credit += n;
    }
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.001 && debit > 0 };
  }, [lines]);

  function updateLine(index: number, patch: Partial<LineDraft>): void {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function accountOptions(kind: LineDraft["accountKind"]): { id: string; label: string }[] {
    if (kind === "cash") return [{ id: "cash", label: "Cash on hand" }];
    if (kind === "bank") {
      return db.bankAccounts.map((a) => ({
        id: a.id,
        label: `${a.bankName} — ${a.accountTitle}`,
      }));
    }
    if (kind === "customer") {
      return db.customers.map((c) => ({ id: c.id, label: c.name }));
    }
    if (kind === "shopkeeper") {
      return db.shopkeepers.map((s) => ({
        id: s.id,
        label: `Shop ${s.shopNo} — ${s.name}`,
      }));
    }
    return (db.expenseAccounts ?? []).map((a) => ({ id: a.id, label: a.name }));
  }

  function onSave(): void {
    setErr(null);
    setMsg(null);
    if (!branchCode) return;
    try {
      const payload: GeneralVoucherLineInput[] = lines.map((l) => ({
        accountKind: l.accountKind,
        accountId: l.accountKind === "cash" ? null : l.accountId || null,
        side: l.side,
        amountPkr: Number(l.amount),
      }));
      recordGeneralVoucher(branchCode, {
        lines: payload,
        entryDate: canSetDate ? entryDate || todayDateInput() : todayDateInput(),
        reference: reference || null,
        note: note || null,
        attachments,
      });
      refresh();
      setMsg("General voucher saved.");
      setLines([emptyLine("debit"), emptyLine("credit")]);
      setReference("");
      setNote("");
      setAttachments([]);
      setEntryDate(todayDateInput());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save general voucher.");
    }
  }

  return (
    <MzPage>
      <PageHeader
        title="General Voucher"
        subtitle="Double-entry adjustments across customers, suppliers, expense accounts, cash, and bank. Debits must equal credits."
      />
      <p className={`text-sm ${mutedClass}`}>
        Cash ↔ Bank transfers only? Use{" "}
        <Link className="font-medium text-teal-700 underline dark:text-teal-400" to="/pops/mobizone/contra-voucher">
          Contra Voucher
        </Link>
        .
      </p>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-600">{msg}</p> : null}

      <MzSection title="New general voucher">
        <div className="grid gap-3 sm:grid-cols-2">
          {canSetDate ? (
            <MzField label="Entry date * (admin)">
              <MzInput
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="mz-date-input"
              />
            </MzField>
          ) : null}
          <MzField label="Reference">
            <MzInput
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="JV-001 / settlement note"
            />
          </MzField>
        </div>
        <MzField label="Details / note">
          <MzTextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Affan paid Basit directly on our behalf"
          />
        </MzField>

        <div className="space-y-3">
          {lines.map((line, index) => {
            const opts = accountOptions(line.accountKind);
            return (
              <div
                key={index}
                className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-5 dark:border-slate-800"
              >
                <MzField label="Side *">
                  <MzSelect
                    value={line.side}
                    onChange={(e) => updateLine(index, { side: e.target.value as "debit" | "credit" })}
                  >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </MzSelect>
                </MzField>
                <MzField label="Account type *">
                  <MzSelect
                    value={line.accountKind}
                    onChange={(e) =>
                      updateLine(index, {
                        accountKind: e.target.value as LineDraft["accountKind"],
                        accountId: e.target.value === "cash" ? "cash" : "",
                      })
                    }
                  >
                    <option value="customer">Customer</option>
                    <option value="shopkeeper">Supplier / shopkeeper</option>
                    <option value="expense">Expense account</option>
                    <option value="cash">Cash</option>
                    <option value="bank">Bank</option>
                  </MzSelect>
                </MzField>
                <MzField label="Account *">
                  <MzSelect
                    value={line.accountKind === "cash" ? "cash" : line.accountId}
                    onChange={(e) => updateLine(index, { accountId: e.target.value })}
                    disabled={line.accountKind === "cash"}
                  >
                    {line.accountKind !== "cash" ? <option value="">Select…</option> : null}
                    {opts.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </MzSelect>
                </MzField>
                <MzField label="Amount (PKR) *">
                  <MzInput
                    type="number"
                    min={0}
                    value={line.amount}
                    onChange={(e) => updateLine(index, { amount: e.target.value })}
                  />
                </MzField>
                <div className="flex items-end">
                  <MzSecondaryButton
                    disabled={lines.length <= 2}
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </MzSecondaryButton>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <MzSecondaryButton onClick={() => setLines((prev) => [...prev, emptyLine("debit")])}>
            Add line
          </MzSecondaryButton>
          <p className={`text-sm ${totals.balanced ? "text-emerald-600" : mutedClass}`}>
            Debit {formatPkr(totals.debit)} · Credit {formatPkr(totals.credit)}
            {totals.balanced ? " · Balanced" : " · Must balance"}
          </p>
        </div>

        <MzDocumentUpload value={attachments} onChange={setAttachments} />

        <MzStickyActions>
          <MzPrimaryButton onClick={onSave} disabled={!totals.balanced}>
            Save general voucher
          </MzPrimaryButton>
        </MzStickyActions>
      </MzSection>

      <MzSection title={`General voucher history · ${history.length}`}>
        <MzDateRangeFilter
          fromDate={fromDate}
          toDate={toDate}
          onChange={(from, t) => {
            setFromDate(from);
            setToDate(t);
          }}
        />
        <ul className="space-y-2 text-sm">
          {history.length === 0 ? (
            <li className={mutedClass}>No general vouchers yet.</li>
          ) : (
            history.map((v) => (
              <li
                key={v.id}
                className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-900 dark:text-white">
                    {v.reference ? `Ref ${v.reference}` : "General voucher"} · {formatPkr(v.amountPkr)}
                  </p>
                  <p className={`text-xs ${mutedClass}`}>{new Date(v.createdAt).toLocaleString()}</p>
                </div>
                {v.note ? <p className={`mt-1 text-xs ${mutedClass}`}>{v.note}</p> : null}
                <MzDocumentLinks files={v.attachments} />
                <ul className="mt-2 space-y-1 text-xs">
                  {v.lines.map((line, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>
                        {line.side === "debit" ? "Dr" : "Cr"} {line.accountName}
                      </span>
                      <span className="tabular-nums">{formatPkr(line.amountPkr)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))
          )}
        </ul>
      </MzSection>
    </MzPage>
  );
}

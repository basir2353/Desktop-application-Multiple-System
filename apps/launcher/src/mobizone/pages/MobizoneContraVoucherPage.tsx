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
  getCashBankBalances,
  monthStartDateInput,
  recordContraVoucher,
  todayDateInput,
  type MoneyAccountRef,
} from "../lib/mobizoneStore";
import {
  MzDateRangeFilter,
  MzDocumentLinks,
  MzDocumentUpload,
  MzField,
  MzInput,
  MzPage,
  MzPrimaryButton,
  MzSection,
  MzSelect,
  MzStickyActions,
  MzTextArea,
  type MzDocumentFile,
} from "../ui/MobizoneUi";

function parseMoneyRef(value: string): MoneyAccountRef {
  if (value === "cash") return { kind: "cash" };
  return { kind: "bank", accountId: value };
}

export function MobizoneContraVoucherPage(): JSX.Element {
  const { branchCode, db, refresh } = useMobizoneDb();
  const claims = useSessionStore((s) => s.claims);
  const canSetDate = canEditMobizoneBillDate(claims);
  const balances = useMemo(() => getCashBankBalances(db), [db]);

  const [from, setFrom] = useState("cash");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(todayDateInput);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<MzDocumentFile[]>([]);
  const [fromDate, setFromDate] = useState(monthStartDateInput);
  const [toDate, setToDate] = useState(todayDateInput);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!to && db.bankAccounts[0]?.id) setTo(db.bankAccounts[0].id);
  }, [db.bankAccounts, to]);

  const history = useMemo(
    () =>
      filterByDateRange(
        (db.vouchers ?? []).filter((v) => v.kind === "contra"),
        fromDate || null,
        toDate || null,
      ),
    [db.vouchers, fromDate, toDate],
  );

  function onSave(): void {
    setErr(null);
    setMsg(null);
    if (!branchCode) return;
    if (!to) {
      setErr("Select the To account.");
      return;
    }
    try {
      recordContraVoucher(branchCode, {
        from: parseMoneyRef(from),
        to: parseMoneyRef(to),
        amountPkr: Number(amount),
        entryDate: canSetDate ? entryDate || todayDateInput() : todayDateInput(),
        reference: reference || null,
        note: note || null,
        attachments,
      });
      refresh();
      setMsg("Contra voucher saved.");
      setAmount("");
      setReference("");
      setNote("");
      setAttachments([]);
      setEntryDate(todayDateInput());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save contra voucher.");
    }
  }

  return (
    <MzPage>
      <PageHeader
        title="Contra Voucher"
        subtitle="Transfer money between Cash and Bank accounts. Cash decreases where money leaves; the other account increases by the same amount."
      />
      <p className={`text-sm ${mutedClass}`}>
        For customers, suppliers, or expenses use{" "}
        <Link className="font-medium text-teal-700 underline dark:text-teal-400" to="/pops/mobizone/general-voucher">
          General Voucher
        </Link>
        .
      </p>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-600">{msg}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
          <p className={`text-xs uppercase ${mutedClass}`}>Cash on hand</p>
          <p className="text-lg font-semibold tabular-nums">{formatPkr(balances.cash)}</p>
        </div>
        {db.bankAccounts.slice(0, 4).map((a) => (
          <div key={a.id} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
            <p className={`text-xs uppercase ${mutedClass}`}>{a.bankName}</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatPkr(balances.byAccount[a.id] ?? a.openingBalancePkr ?? 0)}
            </p>
          </div>
        ))}
      </div>

      <MzSection title="New contra entry">
        <div className="grid gap-3 sm:grid-cols-2">
          {canSetDate ? (
            <MzField label="Transfer date * (admin)">
              <MzInput
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="mz-date-input"
              />
            </MzField>
          ) : null}
          <MzField label="Amount (PKR) *">
            <MzInput type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </MzField>
          <MzField label="From account *">
            <MzSelect value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="cash">Cash on hand</option>
              {db.bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bankName} — {a.accountTitle}
                </option>
              ))}
            </MzSelect>
          </MzField>
          <MzField label="To account *">
            <MzSelect value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="cash">Cash on hand</option>
              {db.bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bankName} — {a.accountTitle}
                </option>
              ))}
            </MzSelect>
          </MzField>
          <MzField label="Reference">
            <MzInput
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Deposit slip / txn id"
            />
          </MzField>
          <MzField label="Details / note">
            <MzTextArea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Cash deposited to HBL"
            />
          </MzField>
        </div>
        <MzDocumentUpload value={attachments} onChange={setAttachments} />
        <MzStickyActions>
          <MzPrimaryButton onClick={onSave}>Save contra voucher</MzPrimaryButton>
        </MzStickyActions>
      </MzSection>

      <MzSection title={`Contra history · ${history.length}`}>
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
            <li className={mutedClass}>No contra vouchers yet.</li>
          ) : (
            history.map((v) => {
              const credit = v.lines.find((l) => l.side === "credit");
              const debit = v.lines.find((l) => l.side === "debit");
              return (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
                >
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {credit?.accountName ?? "—"} → {debit?.accountName ?? "—"}
                    </p>
                    <p className={`text-xs ${mutedClass}`}>
                      {new Date(v.createdAt).toLocaleString()}
                      {v.reference ? ` · Ref ${v.reference}` : ""}
                      {v.note ? ` · ${v.note}` : ""}
                    </p>
                    <MzDocumentLinks files={v.attachments} />
                  </div>
                  <p className="font-semibold tabular-nums text-teal-700 dark:text-teal-400">
                    {formatPkr(v.amountPkr)}
                  </p>
                </li>
              );
            })
          )}
        </ul>
      </MzSection>
    </MzPage>
  );
}

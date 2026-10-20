import type { MobizoneDocumentAttachment } from "@platform/contracts";
import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { pickReferenceDocuments } from "../src/mobizone/documentPick";
import { MzShell } from "../src/mobizone/MzShell";
import {
  filterByDateRange,
  formatPkr,
  monthStartDateInput,
  recordGeneralVoucher,
  seedExpenseAccounts,
  todayDateInput,
  type GeneralVoucherLineInput,
} from "../src/mobizone/storeCore";
import { mz } from "../src/mobizone/theme";
import {
  MzCard,
  MzDateRangeChips,
  MzEmpty,
  MzField,
  MzInput,
  MzPrimaryButton,
  MzScreenTitle,
  MzSection,
} from "../src/mobizone/ui";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

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

export default function MobizoneGeneralVoucherScreen(): React.JSX.Element {
  const accessToken = useSessionStore((s) => s.accessToken);
  const { branchCode, db, refresh, ready } = useMobizoneDb();
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<MobizoneDocumentAttachment[]>([]);
  const [lines, setLines] = useState<LineDraft[]>([emptyLine("debit"), emptyLine("credit")]);
  const [fromDate, setFromDate] = useState(monthStartDateInput);
  const [toDate, setToDate] = useState(todayDateInput);

  useEffect(() => {
    if (!ready || !branchCode) return;
    seedExpenseAccounts(branchCode);
    refresh();
  }, [ready, branchCode, refresh]);

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

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  function accountOptions(kind: LineDraft["accountKind"]): { id: string; label: string }[] {
    if (kind === "cash") return [{ id: "cash", label: "Cash on hand" }];
    if (kind === "bank") {
      return db.bankAccounts.map((a) => ({ id: a.id, label: `${a.bankName}` }));
    }
    if (kind === "customer") return db.customers.map((c) => ({ id: c.id, label: c.name }));
    if (kind === "shopkeeper") {
      return db.shopkeepers.map((s) => ({ id: s.id, label: `Shop ${s.shopNo} — ${s.name}` }));
    }
    return (db.expenseAccounts ?? []).map((a) => ({ id: a.id, label: a.name }));
  }

  function updateLine(index: number, patch: Partial<LineDraft>): void {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function onPickDocs(): Promise<void> {
    try {
      setAttachments(await pickReferenceDocuments(attachments));
    } catch (e) {
      Alert.alert("Upload", e instanceof Error ? e.message : "Could not pick file");
    }
  }

  function onSave(): void {
    if (!ready) return;
    try {
      recordGeneralVoucher(branchCode, {
        lines: lines.map((l) => ({
          accountKind: l.accountKind,
          accountId: l.accountKind === "cash" ? null : l.accountId || null,
          side: l.side,
          amountPkr: Number(l.amount),
        })),
        reference: reference || null,
        note: note || null,
        attachments,
      });
      refresh();
      Alert.alert("Saved", "General voucher saved.");
      setLines([emptyLine("debit"), emptyLine("credit")]);
      setReference("");
      setNote("");
      setAttachments([]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save");
    }
  }

  const kinds: LineDraft["accountKind"][] = [
    "customer",
    "shopkeeper",
    "expense",
    "cash",
    "bank",
  ];

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
        <MzScreenTitle
          title="General Voucher"
          subtitle="Double-entry across customers, suppliers, expenses, cash & bank"
        />
        {!ready ? <ActivityIndicator color={mz.accent} /> : null}

        <MzSection title="New general voucher">
          <MzField label="Reference">
            <MzInput value={reference} onChangeText={setReference} placeholder="JV-001" />
          </MzField>
          <MzField label="Details">
            <MzInput value={note} onChangeText={setNote} placeholder="Optional note" />
          </MzField>

          {lines.map((line, index) => {
            const opts = accountOptions(line.accountKind);
            return (
              <View
                key={index}
                style={{
                  gap: 8,
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: mz.border,
                  backgroundColor: mz.cardSoft,
                }}
              >
                <Text style={{ color: mz.muted, fontSize: 11, fontWeight: "700" }}>
                  LINE {index + 1}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(["debit", "credit"] as const).map((side) => (
                    <Pressable
                      key={side}
                      onPress={() => updateLine(index, { side })}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 8,
                        alignItems: "center",
                        backgroundColor: line.side === side ? mz.ink : mz.white,
                      }}
                    >
                      <Text
                        style={{
                          color: line.side === side ? mz.white : mz.text,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        {side === "debit" ? "Debit" : "Credit"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {kinds.map((k) => (
                    <Pressable
                      key={k}
                      onPress={() =>
                        updateLine(index, {
                          accountKind: k,
                          accountId: k === "cash" ? "cash" : "",
                        })
                      }
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: line.accountKind === k ? mz.accent : mz.white,
                      }}
                    >
                      <Text
                        style={{
                          color: line.accountKind === k ? mz.onGold : mz.text,
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        {k}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {line.accountKind !== "cash" ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {opts.map((o) => (
                      <Pressable
                        key={o.id}
                        onPress={() => updateLine(index, { accountId: o.id })}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: line.accountId === o.id ? mz.ink : mz.white,
                        }}
                      >
                        <Text
                          style={{
                            color: line.accountId === o.id ? mz.white : mz.text,
                            fontSize: 11,
                            fontWeight: "600",
                          }}
                        >
                          {o.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <MzField label="Amount *">
                  <MzInput
                    value={line.amount}
                    onChangeText={(v) => updateLine(index, { amount: v })}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </MzField>
                {lines.length > 2 ? (
                  <Pressable onPress={() => setLines((prev) => prev.filter((_, i) => i !== index))}>
                    <Text style={{ color: mz.rose, fontWeight: "700", textAlign: "center" }}>
                      Remove line
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}

          <Pressable onPress={() => setLines((prev) => [...prev, emptyLine("debit")])}>
            <Text style={{ color: mz.accent, fontWeight: "800", textAlign: "center" }}>+ Add line</Text>
          </Pressable>
          <Text
            style={{
              color: totals.balanced ? mz.green : mz.muted,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            Debit {formatPkr(totals.debit)} · Credit {formatPkr(totals.credit)}
            {totals.balanced ? " · Balanced" : " · Must balance"}
          </Text>

          <Pressable
            onPress={() => void onPickDocs()}
            style={{
              padding: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: mz.border,
              backgroundColor: mz.cardSoft,
            }}
          >
            <Text style={{ color: mz.accent, fontWeight: "800", textAlign: "center" }}>
              Upload documents (any type)
            </Text>
          </Pressable>
          {attachments.map((d) => (
            <Text key={d.id} style={{ color: mz.muted, fontSize: 12 }}>
              · {d.fileName}
            </Text>
          ))}

          <MzPrimaryButton
            label="Save general voucher"
            onPress={onSave}
            disabled={!totals.balanced}
          />
        </MzSection>

        <MzSection title={`History · ${history.length}`}>
          <MzDateRangeChips
            fromDate={fromDate}
            toDate={toDate}
            onChange={(f, t) => {
              setFromDate(f);
              setToDate(t);
            }}
          />
        </MzSection>
        {history.length === 0 ? (
          <MzEmpty title="No general vouchers in this range" />
        ) : (
          history.map((v) => (
            <MzCard key={v.id}>
              <Text style={{ color: mz.text, fontWeight: "700" }}>
                {v.reference ? `Ref ${v.reference}` : "General voucher"} · {formatPkr(v.amountPkr)}
              </Text>
              <Text style={{ color: mz.muted, fontSize: 11, marginTop: 4 }}>
                {new Date(v.createdAt).toLocaleString()}
              </Text>
              {v.lines.map((line, i) => (
                <Text key={i} style={{ color: mz.muted, fontSize: 12, marginTop: 2 }}>
                  {line.side === "debit" ? "Dr" : "Cr"} {line.accountName} · {formatPkr(line.amountPkr)}
                </Text>
              ))}
            </MzCard>
          ))
        )}
      </ScrollView>
    </MzShell>
  );
}

import {
  canCreateMenuCatalog,
  canManageMenuCatalog,
} from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createRestaurantTable,
  createSeatingSection,
  deleteRestaurantTable,
  deleteSeatingSection,
  fetchBranchFloorAdmin,
} from "../src/api/tables";
import { AdminShell } from "../src/components/AdminBottomNav";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Notice,
  SectionHeader,
  StatCard,
  Subtitle,
  Title,
  colors,
} from "../src/components/ui";
import { isAdminOrIncharge } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

export default function AdminTablesScreen() {
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const branchCode = branch?.code;
  const allowed = isAdminOrIncharge(claims);
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const perms = claims?.permissions ?? [];
  const canCreate = canCreateMenuCatalog(perms) || allowed;
  const canEdit = canManageMenuCatalog(perms) || allowed;

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [seats, setSeats] = useState("4");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const floorQuery = useQuery({
    queryKey: ["admin", "tables", branchCode],
    queryFn: () => fetchBranchFloorAdmin(branchCode!),
    enabled: allowed && Boolean(branchCode),
    refetchInterval: 10_000,
  });

  const sections = useMemo(
    () =>
      [...(floorQuery.data?.sections ?? [])]
        .filter((s) => s.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [floorQuery.data?.sections],
  );

  const tables = useMemo(
    () =>
      [...(floorQuery.data?.tables ?? [])].sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true }),
      ),
    [floorQuery.data?.tables],
  );

  useEffect(() => {
    if (sections.length === 0) {
      if (selectedSectionId) setSelectedSectionId(null);
      return;
    }
    if (selectedSectionId && sections.some((s) => s.id === selectedSectionId)) return;
    setSelectedSectionId(sections[0]!.id);
  }, [sections, selectedSectionId]);

  const selectedSection = sections.find((s) => s.id === selectedSectionId) ?? null;

  const sectionTables = useMemo(() => {
    if (!selectedSectionId) return [];
    return tables.filter((t) => t.sectionId === selectedSectionId);
  }, [tables, selectedSectionId]);

  const filteredTables = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sectionTables;
    return sectionTables.filter(
      (t) =>
        t.tableNumber.toLowerCase().includes(q) ||
        String(t.seats).includes(q) ||
        (t.bookedOrderRef ?? "").toLowerCase().includes(q),
    );
  }, [sectionTables, search]);

  const booked = tables.filter((t) => t.bookingStatus === "booked").length;
  const free = tables.filter((t) => t.isActive).length - booked;
  const sectionBooked = sectionTables.filter((t) => t.bookingStatus === "booked").length;

  function invalidate(): void {
    void qc.invalidateQueries({ queryKey: ["admin", "tables"] });
    void qc.invalidateQueries({ queryKey: ["tables"] });
  }

  const createSectionMutation = useMutation({
    mutationFn: (name: string) =>
      createSeatingSection({
        branchCode: branchCode!,
        name,
        sortOrder: sections.length,
      }),
    onSuccess: (section) => {
      invalidate();
      setNewSectionName("");
      setSelectedSectionId(section.id);
      setSearch("");
      setNotice(`Section “${section.name}” added`);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (id: string) => deleteSeatingSection(id),
    onSuccess: () => {
      invalidate();
      setSelectedSectionId(null);
      setNotice("Section removed");
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const createTableMutation = useMutation({
    mutationFn: () =>
      createRestaurantTable({
        branchCode: branchCode!,
        sectionId: selectedSectionId!,
        tableNumber: tableNumber.trim(),
        seats: Number(seats) || 4,
        sortOrder: sectionTables.length,
      }),
    onSuccess: (table) => {
      invalidate();
      setTableNumber("");
      setSeats("4");
      setNotice(`Table ${table.tableNumber} added to ${selectedSection?.name ?? "section"}`);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteTableMutation = useMutation({
    mutationFn: (id: string) => deleteRestaurantTable(id),
    onSuccess: () => {
      invalidate();
      setNotice("Table removed");
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  function confirmDeleteSection(): void {
    if (!selectedSection || !canEdit) return;
    Alert.alert(
      "Delete section",
      `Remove “${selectedSection.name}”? Tables in this section must be removed first.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteSectionMutation.mutate(selectedSection.id),
        },
      ],
    );
  }

  function confirmDeleteTable(tableId: string, number: string): void {
    if (!canEdit) return;
    Alert.alert("Remove table", `Remove table ${number} from ${selectedSection?.name ?? "this section"}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => deleteTableMutation.mutate(tableId),
      },
    ]);
  }

  if (!allowed) return <Redirect href="/" />;

  return (
    <AdminShell tab="more" noPadding>
      <ScrollView
        contentContainerStyle={{
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: insets.top + 12,
          paddingBottom: 28,
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={floorQuery.isFetching}
            onRefresh={() => void floorQuery.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <Title>Table Plan</Title>
        <Subtitle>
          {branchCode
            ? `Select a section, then search or add tables · ${branchCode}`
            : "Select a branch on Home"}
        </Subtitle>

        {!branchCode ? <Notice>Pick a branch on Home first.</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {error ? <Notice>{error}</Notice> : null}

        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard label="Total" value={tables.filter((t) => t.isActive).length} />
          <StatCard label="Free" value={Math.max(0, free)} accent={colors.success} />
          <StatCard
            label="Booked"
            value={booked}
            accent={booked > 0 ? colors.warning : undefined}
          />
        </View>

        {canCreate ? (
          <Card>
            <SectionHeader title="Add section" />
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Input
                style={{ flex: 1 }}
                placeholder="Family Hall, Gents Hall, Lawn…"
                value={newSectionName}
                onChangeText={setNewSectionName}
              />
              <Button
                label="Add"
                loading={createSectionMutation.isPending}
                disabled={!newSectionName.trim() || createSectionMutation.isPending}
                onPress={() => createSectionMutation.mutate(newSectionName.trim())}
              />
            </View>
          </Card>
        ) : null}

        <Card>
          <SectionHeader title="1. Select section" />
          {floorQuery.isLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : sections.length === 0 ? (
            <EmptyState
              title="No sections"
              message="Add a seating section (Family Hall, Gents Hall, Lawn…) to start the table plan."
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 4 }}
            >
              {sections.map((section) => {
                const count = tables.filter((t) => t.sectionId === section.id && t.isActive).length;
                return (
                  <Chip
                    key={section.id}
                    label={section.name}
                    selected={selectedSectionId === section.id}
                    sublabel={`${count} table${count === 1 ? "" : "s"}`}
                    onPress={() => {
                      setSelectedSectionId(section.id);
                      setSearch("");
                      setNotice(null);
                    }}
                  />
                );
              })}
            </ScrollView>
          )}
        </Card>

        {selectedSection ? (
          <>
            <Card>
              <SectionHeader
                title={`2. ${selectedSection.name}`}
                actionLabel={canEdit ? "Delete section" : undefined}
                onAction={canEdit ? confirmDeleteSection : undefined}
              />
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>
                {sectionTables.length} table{sectionTables.length === 1 ? "" : "s"}
                {sectionBooked > 0 ? ` · ${sectionBooked} booked` : ""}
              </Text>

              <Input
                placeholder={`Search tables in ${selectedSection.name}…`}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                autoCorrect={false}
                style={{ marginBottom: canCreate ? 12 : 0 }}
              />

              {canCreate ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                    Add table to this section
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <Input
                      style={{ flex: 1 }}
                      placeholder="Table #"
                      value={tableNumber}
                      onChangeText={setTableNumber}
                      autoCapitalize="characters"
                    />
                    <Input
                      style={{ width: 72 }}
                      placeholder="Seats"
                      value={seats}
                      onChangeText={setSeats}
                      keyboardType="number-pad"
                    />
                    <Button
                      label="Add"
                      loading={createTableMutation.isPending}
                      disabled={
                        !tableNumber.trim() ||
                        createTableMutation.isPending ||
                        !selectedSectionId
                      }
                      onPress={() => createTableMutation.mutate()}
                    />
                  </View>
                </View>
              ) : null}
            </Card>

            <Card>
              <SectionHeader title="Tables in section" />
              {filteredTables.length === 0 ? (
                <EmptyState
                  title={search.trim() ? "No matches" : "No tables"}
                  message={
                    search.trim()
                      ? `No tables match “${search.trim()}” in ${selectedSection.name}.`
                      : `Add tables to ${selectedSection.name} above.`
                  }
                />
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {filteredTables.map((t) => {
                    const busy = t.bookingStatus === "booked";
                    const inactive = !t.isActive;
                    return (
                      <Pressable
                        key={t.id}
                        onLongPress={
                          canEdit ? () => confirmDeleteTable(t.id, t.tableNumber) : undefined
                        }
                        style={{
                          width: "30%",
                          minWidth: 96,
                          flexGrow: 1,
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: busy
                            ? "rgba(15, 118, 110, 0.5)"
                            : inactive
                              ? colors.border
                              : colors.border,
                          backgroundColor: busy
                            ? "rgba(15, 118, 110, 0.12)"
                            : colors.bg,
                          gap: 4,
                          opacity: inactive ? 0.55 : 1,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "800" }}>{t.tableNumber}</Text>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>
                          {t.seats} seats{inactive ? " · hidden" : ""}
                        </Text>
                        <Text
                          style={{
                            color: busy ? colors.accent : colors.success,
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          {busy ? t.bookedOrderRef || "Booked" : "Free"}
                        </Text>
                        {canEdit ? (
                          <Text
                            style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}
                            onPress={() => confirmDeleteTable(t.id, t.tableNumber)}
                          >
                            Remove
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {canEdit ? (
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 10 }}>
                  Tip: long-press a table to remove it.
                </Text>
              ) : null}
            </Card>
          </>
        ) : null}

        {floorQuery.isError ? <Notice>{(floorQuery.error as Error).message}</Notice> : null}
      </ScrollView>
    </AdminShell>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  ADMIN_ROLES,
  createOrgUser,
  fetchOrgUsers,
  resetOrgUserPassword,
  roleLabel,
  updateOrgUser,
  type OrgUser,
} from "../src/api/admin";
import { Button, Card, Chip, Input, Notice, Screen, Subtitle, Title, colors } from "../src/components/ui";
import { isAdminOrIncharge } from "../src/lib/roles";
import { useSessionStore } from "../src/stores/sessionStore";

export default function AdminUsersScreen() {
  const claims = useSessionStore((s) => s.claims);
  const qc = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [branchScope, setBranchScope] = useState("ALL");
  const [role, setRole] = useState("waiter");
  const [staffPin, setStaffPin] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const usersQuery = useQuery({ queryKey: ["admin", "users"], queryFn: fetchOrgUsers });

  const sortedUsers = useMemo(() => {
    const list = [...(usersQuery.data ?? [])];
    list.sort((a, b) => a.email.localeCompare(b.email));
    return list;
  }, [usersQuery.data]);

  const createMutation = useMutation({
    mutationFn: () =>
      createOrgUser({
        email,
        password,
        role,
        branchScope: branchScope.trim() || "ALL",
        pinRequired: Boolean(staffPin),
        staffPin: /^\d{4}$/.test(staffPin) ? staffPin : undefined,
      }),
    onSuccess: (user) => {
      setNotice(`Created ${user.email} (${roleLabel(user.role)})`);
      setError(null);
      setEmail("");
      setPassword("");
      setStaffPin("");
      setShowCreate(false);
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (user: OrgUser) => updateOrgUser(user.id, { active: !user.active }),
    onSuccess: (user) => {
      setNotice(`${user.email} is now ${user.active ? "active" : "disabled"}`);
      setError(null);
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, nextRole }: { userId: string; nextRole: string }) =>
      updateOrgUser(userId, { role: nextRole }),
    onSuccess: (user) => {
      setNotice(`${user.email} role → ${roleLabel(user.role)}`);
      setError(null);
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const resetPwd = useMutation({
    mutationFn: ({ userId, pwd }: { userId: string; pwd: string }) =>
      resetOrgUserPassword(userId, pwd),
    onSuccess: () => {
      setNotice("Password updated");
      setError(null);
      setResetPassword("");
    },
    onError: (e: Error) => setError(e.message),
  });

  if (!isAdminOrIncharge(claims)) {
    return <Redirect href="/" />;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 40 }}>
        <Title>User management</Title>
        <Subtitle>
          Create accounts, assign roles / access, and enable or disable staff logins.
        </Subtitle>

        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {error ? <Notice>{error}</Notice> : null}

        <Button
          label={showCreate ? "Hide create form" : "Create user"}
          variant={showCreate ? "ghost" : "primary"}
          onPress={() => setShowCreate((v) => !v)}
        />

        {showCreate ? (
          <Card>
            <Title>New user</Title>
            <Subtitle>Email, password, role, and branch access.</Subtitle>
            <View style={{ gap: 10, marginTop: 8 }}>
              <Input
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="email@business.com"
                value={email}
                onChangeText={setEmail}
              />
              <Input
                placeholder="Password (min 8 chars)"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <Input
                placeholder="Branch scope (e.g. ISB-GT or ALL)"
                autoCapitalize="characters"
                value={branchScope}
                onChangeText={setBranchScope}
              />
              <Input
                placeholder="Optional 4-digit staff PIN"
                keyboardType="number-pad"
                maxLength={4}
                value={staffPin}
                onChangeText={setStaffPin}
              />
              <Subtitle>Role / access</Subtitle>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {ADMIN_ROLES.map((r) => (
                  <Chip
                    key={r.id}
                    label={r.label}
                    selected={role === r.id}
                    onPress={() => setRole(r.id)}
                  />
                ))}
              </View>
              <Button
                label={createMutation.isPending ? "Creating…" : "Create account"}
                loading={createMutation.isPending}
                onPress={() => {
                  setError(null);
                  if (!email.trim() || password.length < 8) {
                    setError("Email and password (8+ chars) are required.");
                    return;
                  }
                  createMutation.mutate();
                }}
              />
            </View>
          </Card>
        ) : null}

        {usersQuery.isLoading ? <Subtitle>Loading users…</Subtitle> : null}

        {sortedUsers.map((user) => {
          const expanded = expandedId === user.id;
          const isSelf = user.id === claims?.sub;
          return (
            <Card key={user.id}>
              <Pressable
                onPress={() => setExpandedId(expanded ? null : user.id)}
                style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                    {user.email}
                  </Text>
                  <Subtitle>
                    {roleLabel(user.role)} · {user.active ? "Active" : "Disabled"}
                    {user.branchScope ? `\nBranch: ${user.branchScope}` : ""}
                    {user.lastActivityAt ? `\nLast activity: ${user.lastActivityAt}` : ""}
                  </Subtitle>
                </View>
                <Text style={{ color: colors.muted, fontSize: 18 }}>{expanded ? "▾" : "▸"}</Text>
              </Pressable>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <Pressable
                  onPress={() => toggleActive.mutate(user)}
                  disabled={toggleActive.isPending || isSelf}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: user.active ? "#7f1d1d" : "#14532d",
                    opacity: isSelf ? 0.4 : 1,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}>
                    {user.active ? "Disable access" : "Enable access"}
                  </Text>
                </Pressable>
              </View>

              {expanded ? (
                <View style={{ gap: 10, marginTop: 12 }}>
                  <Subtitle>Change role / access level</Subtitle>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {ADMIN_ROLES.map((r) => (
                      <Chip
                        key={r.id}
                        label={r.label}
                        selected={user.role === r.id}
                        disabled={changeRole.isPending || isSelf}
                        onPress={() => {
                          if (user.role === r.id || isSelf) return;
                          changeRole.mutate({ userId: user.id, nextRole: r.id });
                        }}
                      />
                    ))}
                  </View>
                  <Subtitle>Reset password</Subtitle>
                  <Input
                    placeholder="New password (min 8)"
                    secureTextEntry
                    value={expanded ? resetPassword : ""}
                    onChangeText={setResetPassword}
                  />
                  <Button
                    label={resetPwd.isPending ? "Saving…" : "Reset password"}
                    variant="ghost"
                    loading={resetPwd.isPending}
                    onPress={() => {
                      if (resetPassword.length < 8) {
                        setError("Password must be at least 8 characters.");
                        return;
                      }
                      resetPwd.mutate({ userId: user.id, pwd: resetPassword });
                    }}
                  />
                </View>
              ) : null}
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

/**
 * Full live API lifecycle smoke — Super Admin + Restaurant owner.
 * Usage: node local/live-lifecycle-smoke.mjs
 */
const BASE =
  process.env.API_BASE_URL ??
  "https://backend-desktop-production-600b.up.railway.app";

const SUPER = {
  email: process.env.SEED_SUPER_ADMIN_EMAIL ?? "superadmin@pops.platform",
  password: process.env.SEED_SUPER_ADMIN_PASSWORD ?? "SuperAdmin@123",
};
const OWNER = {
  email: process.env.TEST_EMAIL ?? "basit@gmail.com",
  password: process.env.TEST_PASSWORD ?? "basit@gmail.com",
};

function decodeJwt(token) {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
}

async function req(method, path, { token, body, query } = {}) {
  const url = new URL(path.startsWith("http") ? path : `${BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text?.slice(0, 240) ?? null;
    }
    const error =
      res.ok
        ? null
        : typeof data === "object" && data && "message" in data
          ? String(data.message)
          : text?.slice(0, 200) || res.statusText;
    return { ok: res.ok, status: res.status, ms: Date.now() - started, error, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
      data: null,
    };
  }
}

function row(label, r) {
  const mark = r.ok ? "OK " : "ERR";
  const detail = r.ok ? `${r.status} ${r.ms}ms` : `${r.status} ${r.ms}ms — ${r.error}`;
  console.log(`${mark}  ${label.padEnd(48)} ${detail}`);
  return r.ok;
}

async function login(label, creds) {
  const r = await req("POST", "/v1/auth/login", {
    body: { email: creds.email, password: creds.password },
  });
  row(`${label} POST /v1/auth/login`, r);
  if (!r.ok || !r.data?.accessToken) return null;
  const claims = decodeJwt(r.data.accessToken);
  console.log(
    `    ${creds.email} → role=${claims.role} platformRole=${claims.platformRole ?? "-"} org=${claims.organizationId} system=${claims.systemType ?? "-"}`,
  );
  return { token: r.data.accessToken, claims };
}

async function runChecks(title, token, checks) {
  console.log(`\n=== ${title} ===`);
  let ok = 0;
  let fail = 0;
  const failures = [];
  for (const c of checks) {
    const r = await req(c.method, c.path, {
      token,
      query: c.query,
      body: c.body,
    });
    const soft =
      c.softStatuses?.includes(r.status) ||
      (c.softErrorRe && r.error && c.softErrorRe.test(r.error));
    const effective = soft ? { ...r, ok: true } : r;
    if (row(c.label, effective)) ok += 1;
    else {
      fail += 1;
      failures.push({ label: c.label, status: r.status, error: r.error });
    }
  }
  return { ok, fail, failures };
}

async function restaurantWriteLifecycle(token, branchCode) {
  console.log("\n=== Restaurant write lifecycle (POS) ===");
  let ok = 0;
  let fail = 0;
  const failures = [];

  const menu = await req("GET", "/v1/menu", { token, query: { branchCode } });
  if (!row("GET /v1/menu", menu)) {
    return { ok, fail: fail + 1, failures: [{ label: "menu", status: menu.status, error: menu.error }] };
  }
  ok += 1;
  const items = Array.isArray(menu.data?.items) ? menu.data.items : [];
  const item = items.find((i) => i?.id && i?.isActive !== false && Number(i?.price) >= 0);
  if (!item) {
    console.log("ERR  No active menu item for POS create");
    return { ok, fail: fail + 1, failures: [{ label: "menu-item", status: 0, error: "none" }] };
  }

  const create = await req("POST", "/v1/billing/bills", {
    token,
    body: {
      branchCode,
      tableLabel: "LIFECYCLE-SMOKE",
      lines: [
        {
          menuItemId: item.id,
          label: item.name ?? "Item",
          qty: 1,
          unitPrice: Number(item.price) || 0,
        },
      ],
      status: "held",
    },
  });
  if (!row("POST /v1/billing/bills (held)", create)) {
    fail += 1;
    failures.push({ label: "create-bill", status: create.status, error: create.error });
    return { ok, fail, failures };
  }
  ok += 1;
  const billId = create.data?.id;
  if (!billId) {
    fail += 1;
    failures.push({ label: "bill-id", status: 0, error: "missing id" });
    return { ok, fail, failures };
  }

  // No GET /bills/:id route — verify via orders list + PATCH hold note
  const orders = await req("GET", "/v1/billing/orders", { token, query: { branchCode } });
  if (row("GET /v1/billing/orders", orders)) {
    ok += 1;
    const list = Array.isArray(orders.data)
      ? orders.data
      : orders.data?.orders ?? orders.data?.items ?? [];
    const found = list.some((o) => o?.id === billId || o?.billId === billId);
    if (found) {
      console.log("OK   bill visible in orders list".padEnd(52) + "found");
      ok += 1;
    } else {
      console.log("ERR  bill not in orders list".padEnd(52) + billId);
      fail += 1;
      failures.push({ label: "bill-in-orders", status: 0, error: "created bill not listed" });
    }
  } else {
    fail += 1;
    failures.push({ label: "orders", status: orders.status, error: orders.error });
  }

  const patch = await req("PATCH", `/v1/billing/bills/${billId}`, {
    token,
    body: { tableLabel: "LIFECYCLE-SMOKE-UPD" },
  });
  if (row("PATCH /v1/billing/bills/:id", patch)) ok += 1;
  else {
    fail += 1;
    failures.push({ label: "patch-bill", status: patch.status, error: patch.error });
  }

  const del = await req("DELETE", `/v1/billing/bills/${billId}`, { token });
  if (row("DELETE /v1/billing/bills/:id (cleanup)", del)) ok += 1;
  else {
    fail += 1;
    failures.push({ label: "delete-bill", status: del.status, error: del.error });
  }

  return { ok, fail, failures };
}

async function main() {
  console.log(`BASE ${BASE}\n`);

  const health = await req("GET", "/health");
  row("GET /health", health);
  const db = await req("GET", "/health/db");
  row("GET /health/db", db);
  if (db.data?.checks) {
    console.log(
      `    dbHost=${db.data.checks.dbHost} connected=${db.data.checks.connected} users=${db.data.checks.userCount}`,
    );
  }
  if (!db.ok || db.data?.checks?.connected !== true) {
    console.error("\nDB not ready — aborting lifecycle.");
    process.exit(1);
  }

  let totalOk = 0;
  let totalFail = 0;
  const allFailures = [];

  // ---- Super Admin ----
  const superAuth = await login("SUPER", SUPER);
  if (!superAuth) {
    totalFail += 1;
    allFailures.push({ label: "super-login", status: 401, error: "login failed" });
  } else {
    const platform = await runChecks("Super Admin platform APIs", superAuth.token, [
      { label: "GET /v1/platform/businesses", method: "GET", path: "/v1/platform/businesses" },
      { label: "GET /v1/platform/analytics", method: "GET", path: "/v1/platform/analytics" },
      { label: "GET /v1/platform/licence-payments", method: "GET", path: "/v1/platform/licence-payments" },
      { label: "GET /v1/platform/users", method: "GET", path: "/v1/platform/users" },
      { label: "GET /v1/platform/settings", method: "GET", path: "/v1/platform/settings" },
      { label: "GET /v1/security/overview", method: "GET", path: "/v1/security/overview" },
    ]);
    totalOk += platform.ok;
    totalFail += platform.fail;
    allFailures.push(...platform.failures);
  }

  // ---- Restaurant owner ----
  let ownerAuth = await login("OWNER", OWNER);
  if (!ownerAuth) {
    ownerAuth = await login("OWNER-DEMO", {
      email: "admin.restaurant@pops.demo",
      password: "Owner@12345",
    });
  }
  if (!ownerAuth) {
    totalFail += 1;
    allFailures.push({ label: "owner-login", status: 401, error: "login failed" });
  }

  if (ownerAuth?.token) {
    const branchesRes = await req("GET", "/v1/operations/branches", { token: ownerAuth.token });
    row("GET /v1/operations/branches (resolve)", branchesRes);
    const branchList = Array.isArray(branchesRes.data)
      ? branchesRes.data
      : branchesRes.data?.branches ?? branchesRes.data?.items ?? [];
    const firstBranch =
      branchList.find((b) => b?.code || b?.branchCode) ?? branchList[0] ?? null;
    const branchCode =
      firstBranch?.code ?? firstBranch?.branchCode ?? process.env.BRANCH_CODE ?? "MAIN";
    console.log(`    using branchCode=${branchCode} (from ${branchList.length} branches)`);
    if (!firstBranch) {
      console.log("    raw branches payload:", JSON.stringify(branchesRes.data)?.slice(0, 500));
    }

    const reads = await runChecks("Restaurant owner read APIs", ownerAuth.token, [
      { label: "GET /v1/operations/branches", method: "GET", path: "/v1/operations/branches" },
      {
        label: "GET /v1/operations/dashboard",
        method: "GET",
        path: "/v1/operations/dashboard",
        query: { branchCode },
      },
      { label: "GET /v1/menu", method: "GET", path: "/v1/menu", query: { branchCode } },
      {
        label: "GET /v1/billing/orders",
        method: "GET",
        path: "/v1/billing/orders",
        query: { branchCode },
      },
      {
        label: "GET /v1/tables",
        method: "GET",
        path: "/v1/tables",
        query: { branchCode },
      },
      {
        label: "GET /v1/kitchen/tickets",
        method: "GET",
        path: "/v1/kitchen/tickets",
        query: { branchCode },
      },
      {
        label: "GET /v1/inventory",
        method: "GET",
        path: "/v1/inventory",
        query: { branchCode },
      },
      {
        label: "GET /v1/hr/employees",
        method: "GET",
        path: "/v1/hr/employees",
        query: { branchCode },
      },
      { label: "GET /v1/users", method: "GET", path: "/v1/users" },
      {
        label: "GET /v1/accounting/dashboard",
        method: "GET",
        path: "/v1/accounting/dashboard",
        query: { branchCode },
      },
      {
        label: "GET /v1/accounting/expenses",
        method: "GET",
        path: "/v1/accounting/expenses",
        query: { branchCode },
      },
      {
        label: "GET /v1/printing/printers",
        method: "GET",
        path: "/v1/printing/printers",
        query: { branchCode },
      },
      {
        label: "GET /v1/delivery/orders",
        method: "GET",
        path: "/v1/delivery/orders",
        query: { branchCode },
      },
      { label: "GET /v1/reports/catalog", method: "GET", path: "/v1/reports/catalog" },
      {
        label: "GET /v1/reports/sales-by-item",
        method: "GET",
        path: "/v1/reports/sales-by-item",
        query: { branchCode },
      },
      { label: "GET /v1/notifications/overview", method: "GET", path: "/v1/notifications/overview" },
      { label: "GET /v1/multi-branch/overview", method: "GET", path: "/v1/multi-branch/overview" },
      {
        label: "GET /v1/tax-authority/status",
        method: "GET",
        path: "/v1/tax-authority/status",
        query: { branchCode },
      },
    ]);
    totalOk += reads.ok;
    totalFail += reads.fail;
    allFailures.push(...reads.failures);

    const writes = await restaurantWriteLifecycle(ownerAuth.token, branchCode);
    totalOk += writes.ok;
    totalFail += writes.fail;
    allFailures.push(...writes.failures);
  }

  console.log(`\n======== SUMMARY ========`);
  console.log(`OK ${totalOk}  FAIL ${totalFail}`);
  if (allFailures.length) {
    console.log("\nFailures:");
    for (const f of allFailures) console.log(` - ${f.label}: [${f.status}] ${f.error}`);
  }
  process.exit(totalFail > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

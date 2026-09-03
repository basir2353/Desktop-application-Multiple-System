/**
 * Exhaustive restaurant API smoke for basit@gmail.com across all branches.
 * Usage: node local/restaurant-api-smoke.mjs
 */
const BASE =
  process.env.API_BASE_URL ??
  "https://backend-desktop-production-600b.up.railway.app";

const OWNER = {
  email: process.env.TEST_EMAIL ?? "basit@gmail.com",
  password: process.env.TEST_PASSWORD ?? "basit@gmail.com",
};

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
      data = text?.slice(0, 300) ?? null;
    }
    const error =
      res.ok
        ? null
        : typeof data === "object" && data && "message" in data
          ? Array.isArray(data.message)
            ? data.message.join("; ")
            : String(data.message)
          : text?.slice(0, 240) || res.statusText;
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
  console.log(`${mark}  ${label.padEnd(56)} ${r.ok ? `${r.status} ${r.ms}ms` : `${r.status} ${r.ms}ms — ${r.error}`}`);
  return r.ok;
}

async function main() {
  console.log(`BASE ${BASE}\n`);
  const login = await req("POST", "/v1/auth/login", {
    body: { email: OWNER.email, password: OWNER.password },
  });
  if (!row("POST /v1/auth/login", login) || !login.data?.accessToken) {
    process.exit(1);
  }
  const token = login.data.accessToken;
  const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  console.log(
    `    org=${claims.organizationId} role=${claims.role} system=${claims.systemType ?? "-"}`,
  );

  const branchesRes = await req("GET", "/v1/operations/branches", { token });
  row("GET /v1/operations/branches", branchesRes);
  const branchList = Array.isArray(branchesRes.data)
    ? branchesRes.data
    : branchesRes.data?.branches ?? [];
  const codes = branchList.map((b) => b.code).filter(Boolean);
  console.log(`    branches: ${codes.join(", ") || "(none)"}`);
  if (!codes.length) process.exit(2);

  const failures = [];
  let ok = 0;
  let fail = 0;

  async function check(label, method, path, opts = {}) {
    const r = await req(method, path, { token, ...opts });
    // Expected business / missing-route responses (not server crashes)
    const soft =
      (path.includes("cash-sessions/open") && r.status === 404) ||
      (path === "/v1/store/stock" && r.status === 404);
    const effective = soft ? { ...r, ok: true } : r;
    if (soft && !r.ok) {
      console.log(`SOFT ${label.padEnd(56)} ${r.status} — ${r.error} (expected)`);
      ok += 1;
      return r;
    }
    if (row(label, effective)) ok += 1;
    else {
      fail += 1;
      failures.push({ label, status: r.status, error: r.error, branch: opts.query?.branchCode });
    }
    return r;
  }

  // Org-level (no branch) + first-branch deep coverage, then menu/core on every branch
  const primary = codes[0];

  const orgLevel = [
    ["GET /v1/users", "GET", "/v1/users"],
    ["GET /v1/reports/catalog", "GET", "/v1/reports/catalog"],
    ["GET /v1/notifications/overview", "GET", "/v1/notifications/overview"],
    ["GET /v1/multi-branch/overview", "GET", "/v1/multi-branch/overview"],
    ["GET /v1/security/overview", "GET", "/v1/security/overview"],
  ];
  console.log("\n=== Org-level ===");
  for (const [label, method, path] of orgLevel) await check(label, method, path);

  for (const branchCode of codes) {
    console.log(`\n=== Branch ${branchCode} ===`);
    const endpoints = [
      ["operations/dashboard", "GET", "/v1/operations/dashboard"],
      ["menu", "GET", "/v1/menu"],
      ["menu/admin", "GET", "/v1/menu/admin"],
      ["billing/orders", "GET", "/v1/billing/orders"],
      ["billing/waiters", "GET", "/v1/billing/waiters"],
      ["tables", "GET", "/v1/tables"],
      ["kitchen/tickets", "GET", "/v1/kitchen/tickets"],
      ["inventory", "GET", "/v1/inventory"],
      ["inventory/dashboard", "GET", "/v1/inventory/dashboard"],
      ["inventory/warehouses", "GET", "/v1/inventory/warehouses"],
      ["inventory/cooking-units", "GET", "/v1/inventory/cooking-units"],
      ["inventory/cooking-units/stock", "GET", "/v1/inventory/cooking-units/stock"],
      ["inventory/transfers", "GET", "/v1/inventory/transfers"],
      ["inventory/production", "GET", "/v1/inventory/production"],
      ["hr/employees", "GET", "/v1/hr/employees"],
      ["hr/dashboard", "GET", "/v1/hr/dashboard"],
      ["accounting/dashboard", "GET", "/v1/accounting/dashboard"],
      ["accounting/accounts", "GET", "/v1/accounting/accounts"],
      ["accounting/journal", "GET", "/v1/accounting/journal"],
      ["accounting/sales", "GET", "/v1/accounting/sales"],
      ["accounting/expenses", "GET", "/v1/accounting/expenses"],
      ["accounting/vendors", "GET", "/v1/accounting/vendors"],
      ["accounting/receivable", "GET", "/v1/accounting/receivable"],
      ["accounting/inventory", "GET", "/v1/accounting/inventory"],
      ["accounting/cash-sessions", "GET", "/v1/accounting/cash-sessions"],
      ["accounting/cash-sessions/open", "GET", "/v1/accounting/cash-sessions/open"],
      ["accounting/bank-accounts", "GET", "/v1/accounting/bank-accounts"],
      ["accounting/bank-transactions", "GET", "/v1/accounting/bank-transactions"],
      ["accounting/tax", "GET", "/v1/accounting/tax"],
      ["accounting/payroll", "GET", "/v1/accounting/payroll"],
      ["accounting/audit-logs", "GET", "/v1/accounting/audit-logs"],
      ["printing/printers", "GET", "/v1/printing/printers"],
      ["delivery/orders", "GET", "/v1/delivery/orders"],
      ["reports/sales-by-item", "GET", "/v1/reports/sales-by-item"],
      ["tax-authority/status", "GET", "/v1/tax-authority/status"],
      ["store/products", "GET", "/v1/store/products"],
      ["store/warehouses", "GET", "/v1/store/warehouses"],
      ["store/stock", "GET", "/v1/store/stock"],
    ];

    // Deep list only on primary; other branches get core POS set
    const list =
      branchCode === primary
        ? endpoints
        : endpoints.filter(([k]) =>
            [
              "operations/dashboard",
              "menu",
              "menu/admin",
              "billing/orders",
              "tables",
              "kitchen/tickets",
              "inventory",
              "inventory/cooking-units",
              "accounting/dashboard",
            ].includes(k),
          );

    for (const [name, method, path] of list) {
      await check(`GET /v1/${name}`, method, path, { query: { branchCode } });
    }
  }

  // POS write on primary
  console.log(`\n=== POS write (${primary}) ===`);
  const menu = await check("GET /v1/menu (for write)", "GET", "/v1/menu", {
    query: { branchCode: primary },
  });
  const items = Array.isArray(menu.data?.items) ? menu.data.items : [];
  const item = items.find((i) => i?.id);
  if (item) {
    const create = await check("POST /v1/billing/bills", "POST", "/v1/billing/bills", {
      body: {
        branchCode: primary,
        tableLabel: "API-SMOKE",
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
    const billId = create.data?.id;
    if (billId) {
      await check("PATCH /v1/billing/bills/:id", "PATCH", `/v1/billing/bills/${billId}`, {
        body: { tableLabel: "API-SMOKE-2" },
      });
      await check("DELETE /v1/billing/bills/:id", "DELETE", `/v1/billing/bills/${billId}`);
    }
  } else {
    console.log("ERR  no menu item for POS write");
    fail += 1;
  }

  console.log(`\n======== SUMMARY ========`);
  console.log(`OK ${ok}  FAIL ${fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(` - [${f.status}] ${f.label}${f.branch ? ` (${f.branch})` : ""}: ${f.error}`);
    }
  }
  process.exit(fail > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Live smoke: create → delete ingredient/category/supplier and prove they stay gone.
 * Usage: node local/test-inventory-delete-apis.mjs
 */
const BASE =
  process.env.API_BASE_URL ??
  "https://backend-desktop-production-600b.up.railway.app";

const OWNER = {
  email: process.env.TEST_EMAIL ?? "admin.restaurant@pops.demo",
  password: process.env.TEST_PASSWORD ?? "Owner@12345",
};

const stamp = Date.now().toString(36).toUpperCase();
const TAG = `DELTEST-${stamp}`;

async function req(method, path, { token, body, query } = {}) {
  const url = new URL(`${BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const started = Date.now();
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
        ? Array.isArray(data.message)
          ? data.message.join("; ")
          : String(data.message)
        : text?.slice(0, 240) || res.statusText;
  return { ok: res.ok, status: res.status, ms: Date.now() - started, error, data };
}

function pass(msg) {
  console.log(`PASS  ${msg}`);
}
function fail(msg) {
  console.log(`FAIL  ${msg}`);
}

async function main() {
  console.log(`BASE ${BASE}`);
  console.log(`TAG  ${TAG}\n`);

  const health = await req("GET", "/health");
  if (!health.ok) {
    fail(`health ${health.status}`);
    process.exit(1);
  }
  console.log(`health build=${health.data?.build ?? "?"}\n`);

  const login = await req("POST", "/v1/auth/login", {
    body: { email: OWNER.email, password: OWNER.password },
  });
  if (!login.ok || !login.data?.accessToken) {
    fail(`login ${login.status} ${login.error}`);
    process.exit(1);
  }
  const token = login.data.accessToken;
  pass(`login as ${OWNER.email}`);

  const branchesRes = await req("GET", "/v1/operations/branches", { token });
  const branches = Array.isArray(branchesRes.data)
    ? branchesRes.data
    : branchesRes.data?.branches ?? [];
  const branchCode = branches[0]?.code;
  if (!branchCode) {
    fail("no branch");
    process.exit(1);
  }
  pass(`branch ${branchCode}`);

  let failures = 0;

  // ── Category create ─────────────────────────────────────────────
  const catCreate = await req("POST", "/v1/inventory/categories", {
    token,
    body: { branchCode, name: `${TAG}-CAT`, description: "api delete test" },
  });
  if (!catCreate.ok) {
    fail(`create category ${catCreate.status} ${catCreate.error}`);
    process.exit(1);
  }
  const categoryId = catCreate.data.id;
  pass(`create category ${categoryId}`);

  // ── Ingredient create ───────────────────────────────────────────
  const ingCreate = await req("POST", "/v1/inventory/ingredients", {
    token,
    body: {
      branchCode,
      categoryId,
      sku: `${TAG}-SKU`,
      name: `${TAG} Flour`,
      unit: "Kg",
      currentStock: 3,
      minStock: 1,
      reorderLevel: 1,
      maxStock: 10,
      unitCost: 50,
    },
  });
  if (!ingCreate.ok) {
    fail(`create ingredient ${ingCreate.status} ${ingCreate.error}`);
    process.exit(1);
  }
  const ingredientId = ingCreate.data.id;
  pass(`create ingredient ${ingredientId}`);

  // ── Supplier create ─────────────────────────────────────────────
  const supCreate = await req("POST", "/v1/inventory/suppliers", {
    token,
    body: {
      branchCode,
      name: `${TAG}-SUP`,
      phone: "03001234567",
      active: true,
    },
  });
  if (!supCreate.ok) {
    fail(`create supplier ${supCreate.status} ${supCreate.error}`);
    process.exit(1);
  }
  const supplierId = supCreate.data.id;
  pass(`create supplier ${supplierId}`);

  // ── Category delete while ingredient still linked → must 400 ───
  const catBlocked = await req("DELETE", `/v1/inventory/categories/${categoryId}`, { token });
  if (catBlocked.status === 400) {
    pass("delete category blocked while ingredients exist (400)");
  } else {
    fail(`expected 400 deleting non-empty category, got ${catBlocked.status} ${catBlocked.error}`);
    failures += 1;
  }

  // ── Ingredient delete ───────────────────────────────────────────
  const ingDel = await req("DELETE", `/v1/inventory/ingredients/${ingredientId}`, { token });
  if (!ingDel.ok) {
    fail(`delete ingredient ${ingDel.status} ${ingDel.error}`);
    failures += 1;
  } else {
    pass(`delete ingredient ${ingDel.status}`);
  }

  // Refetch inventory — ingredient must be gone
  const inv1 = await req("GET", "/v1/inventory", { token, query: { branchCode } });
  if (!inv1.ok) {
    fail(`GET inventory after ingredient delete ${inv1.status} ${inv1.error}`);
    failures += 1;
  } else {
    const ings = inv1.data?.ingredients ?? [];
    const still = ings.find((i) => i.id === ingredientId || i.sku === `${TAG}-SKU`);
    if (still) {
      fail("ingredient still present after delete (resurrected or delete failed)");
      failures += 1;
    } else {
      pass("ingredient absent after refetch");
    }
  }

  // ── Category delete (now empty) ─────────────────────────────────
  const catDel = await req("DELETE", `/v1/inventory/categories/${categoryId}`, { token });
  if (!catDel.ok) {
    fail(`delete empty category ${catDel.status} ${catDel.error}`);
    failures += 1;
  } else {
    pass(`delete empty category ${catDel.status}`);
  }

  const inv2 = await req("GET", "/v1/inventory", { token, query: { branchCode } });
  if (inv2.ok) {
    const cats = inv2.data?.categories ?? [];
    const stillCat = cats.find((c) => c.id === categoryId || c.name === `${TAG}-CAT`);
    if (stillCat) {
      fail("category still present after delete");
      failures += 1;
    } else {
      pass("category absent after refetch");
    }
  }

  // ── Supplier delete ─────────────────────────────────────────────
  const supDel = await req("DELETE", `/v1/inventory/suppliers/${supplierId}`, { token });
  if (!supDel.ok) {
    fail(`delete supplier ${supDel.status} ${supDel.error}`);
    failures += 1;
  } else {
    pass(`delete supplier ${supDel.status}`);
  }

  const inv3 = await req("GET", "/v1/inventory", { token, query: { branchCode } });
  if (inv3.ok) {
    const sups = inv3.data?.suppliers ?? [];
    const stillSup = sups.find((s) => s.id === supplierId || s.name === `${TAG}-SUP`);
    if (stillSup) {
      fail("supplier still present after delete");
      failures += 1;
    } else {
      pass("supplier absent after refetch");
    }
  }

  // ── Second GET after short wait — prove no demo reseed of our TAG ─
  // (Ignore auditLogs — they correctly keep delete history mentioning TAG.)
  await new Promise((r) => setTimeout(r, 800));
  const inv4 = await req("GET", "/v1/inventory", { token, query: { branchCode } });
  if (inv4.ok) {
    const ings = inv4.data?.ingredients ?? [];
    const cats = inv4.data?.categories ?? [];
    const sups = inv4.data?.suppliers ?? [];
    const resurrected =
      ings.some((i) => i.id === ingredientId || String(i.sku || "").includes(TAG)) ||
      cats.some((c) => c.id === categoryId || String(c.name || "").includes(TAG)) ||
      sups.some((s) => s.id === supplierId || String(s.name || "").includes(TAG));
    if (resurrected) {
      fail("TAG items reappeared in ingredients/categories/suppliers");
      failures += 1;
    } else {
      pass("second refetch still clean (no resurrection of test rows)");
    }
  }

  console.log("");
  if (failures > 0) {
    console.log(`RESULT  ${failures} failure(s)`);
    process.exit(1);
  }
  console.log("RESULT  all delete API checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

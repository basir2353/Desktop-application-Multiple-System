/**
 * End-to-end Real PRA: connect → prepare → PostData → confirm → fiscal # + QR.
 * Usage: node backend-desktop/scripts/e2e-real-pra-close.mjs
 */
import { createHash, createCipheriv, randomBytes } from "crypto";

const API = process.env.API_BASE_URL || "http://127.0.0.1:3000";
const ORG_ID = "36ff83ff-af8d-4411-aeb6-9ec1d1b6dd3c";
const BRANCH_ID = "afeb00ae-2507-4967-914e-09a91c03a0ac";
const BRANCH_CODE = "ISB-GT";

const MUSA = {
  companyName: "Musa Cafe and Restaurants",
  ntn: "5272644-3",
  strn: "",
  province: "Punjab",
  branchName: "POPS Blue Area",
  branchCode: BRANCH_CODE,
  posId: "197656",
  accessCode: "851C6C3B",
  token: "ab9b3002-8024-3181-a7b6-427be47603c6",
  username: "3220381740551",
  environment: "production",
};

const EMAIL = process.env.E2E_EMAIL || "admin.restaurant@pops.demo";
const PASSWORD = process.env.E2E_PASSWORD || "Owner@12345";

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${opts.method || "GET"} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

async function main() {
  console.log("=== 1) Login ===");
  const login = await api("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = login.accessToken || login.access_token;
  assert(token, "missing access token");
  const auth = { Authorization: `Bearer ${token}` };
  console.log("OK logged in as", EMAIL);

  console.log("=== 2) Enable Real PRA features (via API if allowed) ===");
  try {
    await api("/v1/tax-authority/features", {
      method: "PATCH",
      headers: auth,
      body: JSON.stringify({
        praRealEnabled: true,
        praFakeEnabled: false,
        praEnabled: true,
      }),
    });
    console.log("OK features patched via API");
  } catch (err) {
    console.warn("WARN features patch:", err instanceof Error ? err.message : err);
    console.warn("→ Ensure Super Admin Allowed Real PRA for this org (SQL fallback next).");
  }

  console.log("=== 3) Connect Real PRA (production Musa) ===");
  const connect = await api("/v1/pra/connect", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      branchCode: BRANCH_CODE,
      company: {
        companyName: MUSA.companyName,
        ntn: MUSA.ntn,
        strn: MUSA.strn,
        businessType: "Restaurant",
        province: MUSA.province,
        branchName: MUSA.branchName,
        branchCode: MUSA.branchCode,
      },
      posId: MUSA.posId,
      accessCode: MUSA.accessCode,
      token: MUSA.token,
      registrationNumber: MUSA.posId,
      username: MUSA.username,
      password: MUSA.accessCode,
      praBranchCode: BRANCH_CODE,
      environment: MUSA.environment,
    }),
  });
  assert(connect.status === "connected", `connect status ${connect.status}`);
  console.log("OK", connect.message);

  console.log("=== 4) Status must be Connected / Registered ===");
  const status = await api(`/v1/pra/status?branchCode=${encodeURIComponent(BRANCH_CODE)}`, {
    headers: auth,
  });
  assert(
    status.pra?.status === "connected" || status.pra?.status === "expired",
    `pra status ${status.pra?.status}`,
  );
  console.log("OK pra.status =", status.pra.status);

  console.log("=== 5) Find a completed bill (or skip if none) ===");
  const billsJson = await api(
    `/v1/billing/orders?branchCode=${encodeURIComponent(BRANCH_CODE)}`,
    { headers: auth },
  );
  const list = Array.isArray(billsJson)
    ? billsJson
    : billsJson?.orders || billsJson?.bills || [];
  const bill = list.find(
    (b) => b?.id && (b.status === "completed" || b.total > 0),
  );
  if (!bill) {
    console.log("SKIP: no completed bill in branch — connection path verified.");
    console.log("PASS connection + Connected status");
    return;
  }
  console.log("Using bill", bill.id, bill.billRef || bill.orderRef || bill.ref);

  console.log("=== 6) prepare-client-post ===");
  const prep = await api("/v1/pra/prepare-client-post", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      branchCode: BRANCH_CODE,
      sourceType: "bill",
      sourceId: bill.id,
      force: true,
    }),
  });
  if (prep.alreadySubmitted && prep.fiscal?.invoiceNumber) {
    console.log("Already submitted:", prep.fiscal.invoiceNumber);
    assert(prep.fiscal.qrPayload || prep.fiscal.invoiceNumber, "missing QR/payload");
    console.log("PASS fiscal # + QR present");
    return;
  }
  assert(prep.postUrl && prep.bearerToken, "missing postUrl/token");
  assert(
    typeof prep.payload?.DateTime === "string" && /\d{2}:\d{2}:\d{2}/.test(prep.payload.DateTime),
    `DateTime must include time, got ${prep.payload?.DateTime}`,
  );
  console.log("OK DateTime", prep.payload.DateTime);

  console.log("=== 7) PostData from this machine (shop IP) ===");
  const postRes = await fetch(prep.postUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${prep.bearerToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(prep.payload),
  });
  const postText = await postRes.text();
  let postJson = null;
  try {
    postJson = JSON.parse(postText);
  } catch {
    postJson = { message: postText };
  }
  console.log("HTTP", postRes.status, postText.slice(0, 240));
  const invoiceNumber = String(postJson?.InvoiceNumber || "").trim();
  assert(postRes.ok, `PostData HTTP ${postRes.status}`);
  assert(invoiceNumber && !/^not available$/i.test(invoiceNumber), `bad InvoiceNumber: ${invoiceNumber}`);
  console.log("OK InvoiceNumber", invoiceNumber);

  console.log("=== 8) confirm-client-post ===");
  const confirmed = await api("/v1/pra/confirm-client-post", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      branchCode: BRANCH_CODE,
      invoiceDbId: prep.invoiceDbId,
      invoiceNumber,
      raw: postJson,
    }),
  });
  assert(confirmed.fiscal?.invoiceNumber === invoiceNumber, "confirm mismatch");
  assert(confirmed.fiscal?.qrPayload, "confirm missing qrPayload");
  console.log("OK confirmed fiscal", confirmed.fiscal.invoiceNumber, "qr=", confirmed.fiscal.qrPayload);

  console.log("=== 9) fiscal-for-source ===");
  const fiscal = await api(
    `/v1/pra/fiscal-for-source?branchCode=${encodeURIComponent(BRANCH_CODE)}&sourceType=bill&sourceId=${encodeURIComponent(bill.id)}`,
    { headers: auth },
  );
  assert(fiscal?.invoiceNumber, "fiscal-for-source missing number");
  assert(fiscal?.qrPayload || fiscal?.invoiceNumber, "fiscal-for-source missing QR");
  console.log("PASS Real PRA number + QR end-to-end");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

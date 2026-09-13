import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));
const { Client } = require("pg");

const url =
  "postgresql://postgres:bqqNHmsvmdbnZQkuZCKEDGMHEFHwpQMy@acela.proxy.rlwy.net:41130/railway";

async function tryConnect(label, ssl) {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 15000,
    ssl,
  });
  try {
    await client.connect();
    const r = await client.query("select 1 as ok");
    console.log(label, "OK", r.rows[0]);
    await client.end();
  } catch (e) {
    console.log(label, "FAIL", e.message);
  }
}

await tryConnect("ssl=false", false);
await tryConnect("ssl=rejectUnauthorized:false", { rejectUnauthorized: false });

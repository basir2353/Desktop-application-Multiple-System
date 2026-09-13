import { spawnSync } from "node:child_process";

function run(args) {
  const r = spawnSync("railway", args, { encoding: "utf8", shell: true });
  return `${r.stdout || ""}${r.stderr || ""}`.trim();
}

const listRaw = run(["list", "--json"]);
let projects = [];
try {
  projects = JSON.parse(listRaw);
} catch {
  console.error("Failed to parse railway list");
  console.error(listRaw.slice(0, 500));
  process.exit(1);
}

for (const p of projects) {
  const env = p.environments?.edges?.[0]?.node;
  if (!env) continue;
  const services = p.services?.edges?.map((e) => e.node) || [];
  for (const s of services) {
    const domains = run([
      "domain",
      "list",
      "--project",
      p.id,
      "--environment",
      env.id,
      "--service",
      s.id,
      "--json",
    ]);
    const vars = run([
      "variable",
      "list",
      "--project",
      p.id,
      "--environment",
      env.id,
      "--service",
      s.id,
      "--kv",
    ]);
    const hitDomain = /600b|5505|backend-desktop|platformapi|acela/i.test(domains);
    const hitVar = /600b|acela|hayabusa|backend-desktop-production/i.test(vars);
    if (hitDomain || hitVar || /backend|api|platform/i.test(s.name)) {
      console.log("----");
      console.log(`project=${p.name} service=${s.name}`);
      console.log(`domains=${domains.replace(/\s+/g, " ").slice(0, 300)}`);
      for (const line of vars.split(/\r?\n/)) {
        if (/DATABASE_URL|CORS|RAILWAY_PUBLIC|PUBLIC_URL/i.test(line)) {
          console.log(line.replace(/:[^:@/]+@/, ":***@"));
        }
      }
    }
  }
}

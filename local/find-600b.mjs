import { spawnSync } from "node:child_process";

const projects = [
  ["mellow-wholeness", "5bf8ee7e-6420-4365-a782-d1272c304944", "7d1d2b74-4923-4fbe-a502-ac987ed18651"],
  ["graceful-exploration", "cdf06d87-2028-4899-9ce1-38f82b6057cb", "2ebe1d60-b307-43cd-bc14-d3c6b864d193"],
  ["worthy-emotion", "77ec2ada-bf8f-437e-9987-eb71651936c7", "ad137d8f-6a03-455c-bbd5-05dcaff6cd84"],
  ["positive-patience", "8e35269c-b74f-4fab-a7f3-390cf271df50", "97d686e7-fc47-4f3a-96a6-1d80b51d913b"],
  ["gleaming-gratitude", "79556a13-ff0d-4c95-b633-6aa6102a5170", "e790736e-30bc-43cd-bc92-d9f76b0807f1"],
  ["carefree-passion", "57b49338-e1e0-4ae5-865c-bf35262511d2", "b63490e8-7736-410c-87e3-a416073c629f"],
  ["industrious-truth", "877764ad-a250-4689-b4ee-0f6142a7e64f", "84d091ff-3adb-4bb4-a8a5-835851a39d31"],
  ["gallant-presence", "d6c9975f-29ca-4c17-9daa-2fa4d8cdba73", "0cc94a5a-8c56-4663-887d-302e5d5ba490"],
];

for (const [name, project, env] of projects) {
  const list = spawnSync(
    "railway",
    ["domain", "list", "--project", project, "--environment", env, "--json"],
    { encoding: "utf8", shell: true },
  );
  const out = `${list.stdout || ""}${list.stderr || ""}`;
  if (out.includes("600b")) {
    console.log(`FOUND ${name}`);
    console.log(out);
  } else {
    console.log(`${name}: no 600b`);
  }
}

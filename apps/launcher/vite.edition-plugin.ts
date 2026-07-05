import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routesDir = path.resolve(__dirname, "src", "routes");

type SystemKey = "restaurant" | "pharmacy" | "general-store";

// Each system's route module is the single entry point to all of that system's
// pages (every page is a `lazy(() => import(...))` inside it). Stubbing the
// route module in a locked build removes those dynamic imports, so the bundler
// drops the entire page tree for systems that weren't selected — yielding a
// lightweight installer that ships only the chosen module.
const ROUTE_MODULES: Record<SystemKey, string> = {
  restaurant: path.join(routesDir, "restaurantRoutes.tsx"),
  pharmacy: path.join(routesDir, "pharmacyRoutes.tsx"),
  "general-store": path.join(routesDir, "generalStoreRoutes.tsx"),
};

const STUBS: Record<SystemKey, string> = {
  restaurant: "export function restaurantRoutes(){return null}",
  pharmacy: "export function pharmacyRoutes(){return null}",
  "general-store": "export function generalStoreRoutes(){return null}",
};

function normalize(id: string): string {
  return (id.split("?")[0] ?? id).replace(/\\/g, "/");
}

/**
 * Physically excludes non-selected business systems from a locked build.
 * `suite` ships everything; any other edition stubs the other systems' route
 * modules so their pages never enter the bundle.
 */
export function editionExcludePlugin(edition: string): Plugin {
  const stubbed = new Map<string, string>();

  if (edition !== "suite") {
    (Object.keys(ROUTE_MODULES) as SystemKey[]).forEach((sys) => {
      if (sys === edition) return;
      stubbed.set(normalize(ROUTE_MODULES[sys]), STUBS[sys]);
    });
  }

  return {
    name: "platform-edition-exclude",
    enforce: "pre",
    load(id) {
      if (edition === "suite") return null;
      return stubbed.get(normalize(id)) ?? null;
    },
  };
}

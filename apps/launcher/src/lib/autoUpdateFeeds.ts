export type UpdateFeedInfo = {
  id: string;
  label: string;
  localVersion: string;
  publishedVersion: string | null;
  publishedUrl: string | null;
  ok: boolean;
  error?: string;
};

const DESKTOP_REPO = "basir2353/pops-desktop-updates";
const MOBILE_REPO = "basir2353/pops-mobile-updates";

const DESKTOP_FEEDS = {
  suite: {
    manifest: "latest-suite.json",
    label: "Desktop · Universal",
    downloadTag: (v: string) =>
      `https://github.com/${DESKTOP_REPO}/releases/download/desktop-v${v}/POPS-Universal-Management-System_${v}_x64-setup.exe`,
  },
  restaurant: {
    manifest: "latest-restaurant.json",
    label: "Desktop · Restaurant",
    downloadTag: (v: string) =>
      `https://github.com/${DESKTOP_REPO}/releases/download/desktop-v${v}/Restaurant-Management-System_${v}_x64-setup.exe`,
  },
} as const;

const MOBILE_FEEDS = {
  admin: {
    manifest: "latest-admin.json",
    label: "Mobile · Admin APK",
    downloadTag: (v: string) =>
      `https://github.com/${MOBILE_REPO}/releases/download/mobile-v${v}/pops-admin-release.apk`,
  },
  staff: {
    manifest: "latest-staff.json",
    label: "Mobile · Staff APK",
    downloadTag: (v: string) =>
      `https://github.com/${MOBILE_REPO}/releases/download/mobile-v${v}/pops-staff-release.apk`,
  },
} as const;

type GhRelease = {
  tag_name?: string;
  assets?: Array<{ name: string; browser_download_url: string }>;
};

function versionFromTag(tag: string, prefix: "desktop" | "mobile"): string | null {
  const m = tag.match(new RegExp(`^${prefix}-v(.+)$`, "i"));
  return m?.[1]?.trim() || null;
}

/** GitHub API works in browser; raw release/download URLs often fail CORS from localhost. */
async function fetchGitHubRelease(repo: string): Promise<{ release: GhRelease | null; error?: string }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return { release: null, error: `HTTP ${res.status}` };
    return { release: (await res.json()) as GhRelease };
  } catch (err) {
    return { release: null, error: err instanceof Error ? err.message : "Fetch failed" };
  }
}

export async function fetchAutoUpdateStatus(input: {
  desktopVersion: string;
  mobileVersion: string;
}): Promise<UpdateFeedInfo[]> {
  const rows: UpdateFeedInfo[] = [];

  const desktop = await fetchGitHubRelease(DESKTOP_REPO);
  const desktopVersion = desktop.release?.tag_name
    ? versionFromTag(desktop.release.tag_name, "desktop")
    : null;

  for (const [id, feed] of Object.entries(DESKTOP_FEEDS)) {
    const asset = desktop.release?.assets?.find((a) => a.name === feed.manifest);
    rows.push({
      id: `desktop-${id}`,
      label: feed.label,
      localVersion: input.desktopVersion,
      publishedVersion: desktopVersion,
      publishedUrl: asset?.browser_download_url ?? (desktopVersion ? feed.downloadTag(desktopVersion) : null),
      ok: desktopVersion === input.desktopVersion && Boolean(asset),
      error: desktop.error ?? (!asset && desktopVersion ? `Missing ${feed.manifest} on release` : undefined),
    });
  }

  const mobile = await fetchGitHubRelease(MOBILE_REPO);
  const mobileVersion = mobile.release?.tag_name
    ? versionFromTag(mobile.release.tag_name, "mobile")
    : null;

  for (const [id, feed] of Object.entries(MOBILE_FEEDS)) {
    const asset = mobile.release?.assets?.find((a) => a.name === feed.manifest);
    rows.push({
      id: `mobile-${id}`,
      label: feed.label,
      localVersion: input.mobileVersion,
      publishedVersion: mobileVersion,
      publishedUrl: asset?.browser_download_url ?? (mobileVersion ? feed.downloadTag(mobileVersion) : null),
      ok: mobileVersion === input.mobileVersion && Boolean(asset),
      error: mobile.error ?? (!mobileVersion ? "No mobile release yet" : !asset ? `Missing ${feed.manifest}` : undefined),
    });
  }

  return rows;
}

export { DESKTOP_FEEDS, MOBILE_FEEDS, DESKTOP_REPO, MOBILE_REPO };

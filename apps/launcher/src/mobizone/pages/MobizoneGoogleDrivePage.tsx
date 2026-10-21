import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { mutedClass } from "../../pops/lib/themeClasses";
import {
  disconnectGoogleDrive,
  fetchGoogleDriveStatus,
  startGoogleDriveConnect,
  type GoogleDriveStatus,
} from "../lib/googleDriveApi";
import { MzPage, MzPrimaryButton, MzSecondaryButton, MzSection } from "../ui/MobizoneUi";

export function MobizoneGoogleDrivePage(): JSX.Element {
  const [status, setStatus] = useState<GoogleDriveStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await fetchGoogleDriveStatus();
    setStatus(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onConnect(): Promise<void> {
    setBusy(true);
    setMsg(null);
    try {
      const url = await startGoogleDriveConnect();
      window.open(url, "_blank", "noopener,noreferrer");
      setMsg("Google window opened — finish sign-in, then click Refresh status.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect(): Promise<void> {
    setBusy(true);
    setMsg(null);
    try {
      const next = await disconnectGoogleDrive();
      setStatus(next);
      setMsg("Google Drive disconnected. New photos stay in the app only.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MzPage>
      <PageHeader
        title="Google Drive"
        subtitle="Optional — if connected, MobiZone photos & documents upload to this shop’s Drive instead of bloating the API."
      />

      <MzSection title="Connection (optional)">
        {!status ? (
          <p className={mutedClass}>Checking…</p>
        ) : !status.configured ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Server is missing <code className="text-xs">GOOGLE_DRIVE_*</code> env vars. Add them on
            Railway (see <code className="text-xs">local/google-drive.env.example</code>) and redeploy.
          </p>
        ) : status.connected ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium text-[var(--mz-text)]">
              Connected{status.email ? ` · ${status.email}` : ""}
            </p>
            {status.connectedAt ? (
              <p className={mutedClass}>Since {new Date(status.connectedAt).toLocaleString()}</p>
            ) : null}
            <p className={mutedClass}>
              New camera / document attachments will be stored in a Drive folder{" "}
              <strong>POPS-MobiZone-…</strong> for this shop.
            </p>
          </div>
        ) : (
          <p className={mutedClass}>
            Not connected. App works as before (local / data URLs). Connect only if you want files on
            the user’s Google Drive.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {status?.configured && !status.connected ? (
            <MzPrimaryButton disabled={busy} onClick={() => void onConnect()}>
              Connect Google Drive
            </MzPrimaryButton>
          ) : null}
          {status?.connected ? (
            <MzSecondaryButton disabled={busy} onClick={() => void onDisconnect()}>
              Disconnect
            </MzSecondaryButton>
          ) : null}
          <MzSecondaryButton disabled={busy} onClick={() => void refresh()}>
            Refresh status
          </MzSecondaryButton>
        </div>
        {msg ? <p className={`mt-3 text-sm ${mutedClass}`}>{msg}</p> : null}
      </MzSection>
    </MzPage>
  );
}

import { Button } from "@platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPlatformSettings, updatePlatformSettings } from "../lib/platformApi";
import { fieldInputClass, headingClass, mutedClass } from "../pops/lib/themeClasses";

export function SuperAdminBroadcastPage(): JSX.Element {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["platform", "settings"], queryFn: fetchPlatformSettings });
  const [supportEmail, setSupportEmail] = useState("");
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.data) return;
    const email = settings.data.entries.support_email;
    const banner = settings.data.entries.maintenance_message;
    setSupportEmail(typeof email === "string" ? email : email != null ? String(email) : "");
    setMaintenanceMessage(
      typeof banner === "string" ? banner : banner != null ? String(banner) : "",
    );
  }, [settings.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      updatePlatformSettings({
        entries: {
          support_email: supportEmail.trim(),
          maintenance_message: maintenanceMessage.trim(),
        },
      }),
    onSuccess: async () => {
      setMessage("Broadcast saved. Login screens pick up the banner immediately.");
      await qc.invalidateQueries({ queryKey: ["platform", "settings"] });
      await qc.invalidateQueries({ queryKey: ["platform", "public-info"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-lg font-semibold ${headingClass}`}>Broadcast</h2>
        <p className={`mt-1 text-sm ${mutedClass}`}>
          Global maintenance banner and support contact shown on all login screens.
        </p>
      </div>

      {message ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
          {message}
        </p>
      ) : null}

      <div className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-5 border-slate-200 bg-white">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Support email</span>
          <input
            className={fieldInputClass}
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            placeholder="support@example.com"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Maintenance message</span>
          <textarea
            className={`${fieldInputClass} min-h-[120px]`}
            value={maintenanceMessage}
            onChange={(e) => setMaintenanceMessage(e.target.value)}
            placeholder="Leave empty to hide the banner"
          />
          <span className={`mt-1 block text-xs ${mutedClass}`}>
            Non-empty text appears globally. Clear the field to remove the banner.
          </span>
        </label>
        <Button type="button" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
          {saveMut.isPending ? "Saving…" : "Publish broadcast"}
        </Button>
      </div>

      <p className={`text-xs ${mutedClass}`}>
        More keys (default licence plan, session notes) live under{" "}
        <Link to="/super-admin/settings" className="text-teal-700 underline dark:text-teal-300">
          Settings
        </Link>
        .
      </p>
    </div>
  );
}

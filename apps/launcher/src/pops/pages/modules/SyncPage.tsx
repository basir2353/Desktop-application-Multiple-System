import { Button } from "@platform/ui";
import { syncEvents } from "../../data/fixtures";
import { Badge } from "../../ui/Badge";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleTable } from "../../ui/SimpleTable";

export function SyncPage(): JSX.Element {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Sync & backup"
        subtitle="Offline queue, cloud reconciliation, scheduled backups, restore."
        actions={
          <>
            <Button variant="ghost" className="text-xs">
              Force sync now
            </Button>
            <Button className="text-xs">Backup now</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm">
        <Badge tone="success">Online</Badge>
        <span className="text-slate-400">Last full sync · 2 minutes ago</span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400">Pending outbox · 3 operations</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-medium text-white">Recent sync activity</div>
          <SimpleTable
            rowKey={(r) => `${String(r.time)}-${String(r.event)}`}
            columns={[
              { key: "time", header: "Time" },
              { key: "event", header: "Event" },
              {
                key: "result",
                header: "Result",
                id: "res",
                render: (r) => (
                  <Badge tone={r.result === "OK" ? "success" : "warning"}>{String(r.result)}</Badge>
                ),
              },
              { key: "rows", header: "Rows" },
            ]}
            rows={syncEvents as unknown as Record<string, unknown>[]}
          />
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm font-medium text-white">Backup schedule</div>
          <label className="mt-3 block text-xs text-slate-400">
            Daily at
            <select className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white">
              <option>02:00</option>
              <option>03:30</option>
            </select>
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" className="accent-amber-500" defaultChecked />
            Include attachments
          </label>
          <Button variant="ghost" className="mt-4 w-full text-xs">
            Restore from backup…
          </Button>
        </div>
      </div>
    </div>
  );
}

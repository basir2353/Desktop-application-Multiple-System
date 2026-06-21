import { Button } from "@platform/ui";
import { customers } from "../../data/fixtures";
import { Badge } from "../../ui/Badge";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleTable } from "../../ui/SimpleTable";

export function CrmPage(): JSX.Element {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers (CRM)"
        subtitle="Profiles, loyalty, credit, campaigns, and messaging."
        actions={
          <>
            <Button variant="ghost" className="text-xs">
              New customer
            </Button>
            <Button className="text-xs">Send promotion</Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <input
          placeholder="Search name or phone…"
          className="min-w-[12rem] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white sm:max-w-sm"
        />
        <select className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">
          <option>All segments</option>
          <option>High value</option>
          <option>Credit</option>
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SimpleTable
          rowKey={(r) => String(r.id)}
          columns={[
            { key: "id", header: "ID" },
            { key: "name", header: "Name" },
            { key: "phone", header: "Phone" },
            { key: "points", header: "Points" },
            { key: "balance", header: "Balance (Rs)", render: (r) => Number(r.balance).toLocaleString() },
            {
              key: "segment",
              header: "Segment",
              id: "seg",
              render: (r) => <Badge tone="neutral">{String(r.segment)}</Badge>,
            },
          ]}
          rows={customers as unknown as Record<string, unknown>[]}
        />
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm font-medium text-white">Campaign queue</div>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li className="flex justify-between">
              <span>Birthday SMS — May</span>
              <Button variant="ghost" className="text-xs">
                Run
              </Button>
            </li>
            <li className="flex justify-between">
              <span>WhatsApp — Friday grill</span>
              <Button variant="ghost" className="text-xs">
                Schedule
              </Button>
            </li>
            <li className="flex justify-between">
              <span>Feedback NPS</span>
              <Button variant="ghost" className="text-xs">
                Send
              </Button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

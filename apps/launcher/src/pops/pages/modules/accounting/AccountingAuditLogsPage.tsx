import { useQuery } from "@tanstack/react-query";
import { fetchAccountingAuditLogs } from "../../../api/accounting";
import { useAccountingAccess } from "../../../hooks/useAccounting";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { AccountingError, AccountingLoading } from "./AccountingUi";

export function AccountingAuditLogsPage(): JSX.Element {
  const { branch } = useAccountingAccess();

  const logsQuery = useQuery({
    queryKey: ["accounting", "audit-logs", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchAccountingAuditLogs(branch!.code),
  });

  if (logsQuery.isLoading) return <AccountingLoading />;
  if (logsQuery.isError) return <AccountingError message={(logsQuery.error as Error).message} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounting audit logs"
        subtitle="Track every financial action — who created, modified, and when."
      />

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <SimpleTable
          rowKey={(r) => String(r.id)}
          columns={[
            { key: "createdAt", header: "Time", render: (r) => new Date(String(r.createdAt)).toLocaleString() },
            { key: "actorEmail", header: "User" },
            { key: "entityType", header: "Entity" },
            { key: "action", header: "Action" },
            { key: "entityId", header: "ID", render: (r) => String(r.entityId).slice(0, 8) },
          ]}
          rows={logsQuery.data! as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}

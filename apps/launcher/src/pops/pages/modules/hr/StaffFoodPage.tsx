import { StaffFoodPanel } from "../../../components/StaffFoodPanel";
import { PageHeader } from "../../../ui/PageHeader";

export function StaffFoodPage(): JSX.Element {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff food"
        subtitle="Link meals to employees, expense accounts, and optional suppliers. Amounts create a Pending expense under Accounting."
      />
      <StaffFoodPanel />
    </div>
  );
}

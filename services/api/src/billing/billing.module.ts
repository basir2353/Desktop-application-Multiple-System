import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { ClosingModule } from "../closing/closing.module";
import { InventoryModule } from "../inventory/inventory.module";
import { PermissionsGuard } from "../users/permissions.guard";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";

@Module({
  imports: [InventoryModule, AccountingModule, ClosingModule],
  controllers: [BillingController],
  providers: [BillingService, PermissionsGuard],
  exports: [BillingService],
})
export class BillingModule {}

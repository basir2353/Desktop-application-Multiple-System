import { join } from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AccountingModule } from "./accounting/accounting.module";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { CatalogModule } from "./catalog/catalog.module";
import { DeliveryModule } from "./delivery/delivery.module";
import { DrizzleModule } from "./drizzle/drizzle.module";
import { MailModule } from "./mail/mail.module";
import { HealthModule } from "./health/health.module";
import { HrModule } from "./hr/hr.module";
import { MultiBranchModule } from "./multi-branch/multi-branch.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { InventoryModule } from "./inventory/inventory.module";
import { KitchenModule } from "./kitchen/kitchen.module";
import { MenuModule } from "./menu/menu.module";
import { OperationsModule } from "./operations/operations.module";
import { SyncModule } from "./sync/sync.module";
import { ClosingModule } from "./closing/closing.module";
import { SecurityModule } from "./security/security.module";
import { TablesModule } from "./tables/tables.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // pnpm runs this package with cwd `services/api`; repo-root `.env` lives two levels up.
      envFilePath: [join(process.cwd(), ".env"), join(process.cwd(), "..", "..", ".env")],
    }),
    DrizzleModule,
    MailModule,
    HealthModule,
    AuthModule,
    AccountingModule,
    BillingModule,
    CatalogModule,
    DeliveryModule,
    OperationsModule,
    MenuModule,
    InventoryModule,
    HrModule,
    MultiBranchModule,
    NotificationsModule,
    KitchenModule,
    TablesModule,
    UsersModule,
    SyncModule,
    SecurityModule,
    ClosingModule,
  ],
})
export class AppModule {}

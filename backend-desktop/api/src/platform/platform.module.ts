import { Module } from "@nestjs/common";
import { OrgAlertsModule } from "../org-alerts/org-alerts.module";
import { PermissionsGuard } from "../users/permissions.guard";
import { PlatformLicenceReminderJob } from "./platform-licence-reminder.job";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";

@Module({
  imports: [OrgAlertsModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformLicenceReminderJob, PermissionsGuard],
  exports: [PlatformService],
})
export class PlatformModule {}

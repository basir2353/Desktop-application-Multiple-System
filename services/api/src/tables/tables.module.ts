import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../users/permissions.guard";
import { TablesController } from "./tables.controller";
import { TablesService } from "./tables.service";

@Module({
  controllers: [TablesController],
  providers: [TablesService, PermissionsGuard],
  exports: [TablesService],
})
export class TablesModule {}

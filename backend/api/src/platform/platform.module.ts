import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../users/permissions.guard";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";

@Module({
  controllers: [PlatformController],
  providers: [PlatformService, PermissionsGuard],
  exports: [PlatformService],
})
export class PlatformModule {}

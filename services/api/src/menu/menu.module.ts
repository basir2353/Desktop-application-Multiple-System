import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../users/permissions.guard";
import { MenuController } from "./menu.controller";
import { MenuService } from "./menu.service";
import { MenuUploadService } from "./menu-upload.service";

@Module({
  controllers: [MenuController],
  providers: [MenuService, MenuUploadService, PermissionsGuard],
  exports: [MenuService],
})
export class MenuModule {}

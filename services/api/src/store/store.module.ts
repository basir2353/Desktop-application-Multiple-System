import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../users/permissions.guard";
import { StoreController } from "./store.controller";
import { StoreService } from "./store.service";

@Module({
  controllers: [StoreController],
  providers: [StoreService, PermissionsGuard],
  exports: [StoreService],
})
export class StoreModule {}

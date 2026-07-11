import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../users/permissions.guard";
import { StoreController } from "./store.controller";
import { StoreGroceryService } from "./store-grocery.service";
import { StoreService } from "./store.service";

@Module({
  controllers: [StoreController],
  providers: [StoreService, StoreGroceryService, PermissionsGuard],
  exports: [StoreService, StoreGroceryService],
})
export class StoreModule {}

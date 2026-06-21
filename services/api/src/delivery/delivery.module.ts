import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../users/permissions.guard";
import { DeliveryController } from "./delivery.controller";
import { DeliveryService } from "./delivery.service";

@Module({
  controllers: [DeliveryController],
  providers: [DeliveryService, PermissionsGuard],
  exports: [DeliveryService],
})
export class DeliveryModule {}

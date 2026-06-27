import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../users/permissions.guard";
import { PharmacyController } from "./pharmacy.controller";
import { PharmacyService } from "./pharmacy.service";

@Module({
  controllers: [PharmacyController],
  providers: [PharmacyService, PermissionsGuard],
  exports: [PharmacyService],
})
export class PharmacyModule {}

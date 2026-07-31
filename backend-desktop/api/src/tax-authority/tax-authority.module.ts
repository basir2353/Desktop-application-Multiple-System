import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../users/permissions.guard";
import { PraPublicController } from "./pra-public.controller";
import { TaxAuthorityController } from "./tax-authority.controller";
import { TaxAuthorityService } from "./tax-authority.service";

@Module({
  controllers: [TaxAuthorityController, PraPublicController],
  providers: [TaxAuthorityService, PermissionsGuard],
  exports: [TaxAuthorityService],
})
export class TaxAuthorityModule {}

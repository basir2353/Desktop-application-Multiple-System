import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  createDoctorSchema,
  createMedicineSchema,
  createPatientSchema,
  createPharmacySaleSchema,
  createPrescriptionSchema,
} from "@platform/contracts";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessJwtPayload } from "../auth/jwt.types";
import { PermissionsGuard } from "../users/permissions.guard";
import { RequirePermissions } from "../users/require-permission.decorator";
import { PharmacyService } from "./pharmacy.service";

@Controller("v1/pharmacy")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PharmacyController {
  constructor(private readonly pharmacy: PharmacyService) {}

  @Get("dashboard")
  @RequirePermissions("pops.read")
  getDashboard(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.pharmacy.getDashboard(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("medicines")
  @RequirePermissions("pops.read")
  listMedicines(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.pharmacy.listMedicines(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("medicines")
  @RequirePermissions("pops.inventory.manage")
  createMedicine(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.pharmacy.createMedicine(user.organizationId, createMedicineSchema.parse(body));
  }

  @Delete("medicines/:medicineId")
  @RequirePermissions("pops.inventory.manage")
  deleteMedicine(@CurrentUser() user: AccessJwtPayload, @Param("medicineId") medicineId: string) {
    return this.pharmacy.deleteMedicine(user.organizationId, medicineId);
  }

  @Get("batches")
  @RequirePermissions("pops.read")
  listBatches(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.pharmacy.listBatches(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("patients")
  @RequirePermissions("pops.read")
  listPatients(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.pharmacy.listPatients(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("patients")
  @RequirePermissions("pops.read")
  createPatient(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.pharmacy.createPatient(user.organizationId, createPatientSchema.parse(body));
  }

  @Get("doctors")
  @RequirePermissions("pops.read")
  listDoctors(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.pharmacy.listDoctors(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("doctors")
  @RequirePermissions("pops.read")
  createDoctor(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.pharmacy.createDoctor(user.organizationId, createDoctorSchema.parse(body));
  }

  @Get("prescriptions")
  @RequirePermissions("pops.read")
  listPrescriptions(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.pharmacy.listPrescriptions(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("prescriptions")
  @RequirePermissions("pops.read")
  createPrescription(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.pharmacy.createPrescription(user.organizationId, createPrescriptionSchema.parse(body));
  }

  @Patch("prescriptions/:prescriptionId/verify")
  @RequirePermissions("pops.read")
  verifyPrescription(@CurrentUser() user: AccessJwtPayload, @Param("prescriptionId") prescriptionId: string) {
    return this.pharmacy.verifyPrescription(user.organizationId, prescriptionId);
  }

  @Post("prescriptions/:prescriptionId/dispense")
  @RequirePermissions("pops.read")
  dispensePrescription(
    @CurrentUser() user: AccessJwtPayload,
    @Param("prescriptionId") prescriptionId: string,
    @Query("branchCode") branchCode: string,
  ) {
    return this.pharmacy.dispensePrescription(user.organizationId, prescriptionId, branchCode?.trim() ?? "");
  }

  @Get("sales")
  @RequirePermissions("pops.read")
  listSales(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.pharmacy.listSales(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("sales")
  @RequirePermissions("pops.read")
  createSale(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.pharmacy.createSale(user.organizationId, createPharmacySaleSchema.parse(body));
  }

  @Get("reports/purchase-statement")
  @RequirePermissions("pops.read")
  getPurchaseStatement(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.pharmacy.getPurchaseStatement(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("reports/supplier-payments")
  @RequirePermissions("pops.read")
  getSupplierPayments(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.pharmacy.getSupplierPayments(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("reports/sales-statement")
  @RequirePermissions("pops.read")
  getSalesStatement(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.pharmacy.getSalesStatement(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("reports/profit-loss")
  @RequirePermissions("pops.read")
  getProfitLoss(
    @CurrentUser() user: AccessJwtPayload,
    @Query("branchCode") branchCode: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.pharmacy.getProfitLoss(user.organizationId, branchCode?.trim() ?? "", from?.trim(), to?.trim());
  }

  @Get("reports/sales-of-month")
  @RequirePermissions("pops.read")
  getSalesOfMonth(
    @CurrentUser() user: AccessJwtPayload,
    @Query("branchCode") branchCode: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.pharmacy.getSalesOfMonth(user.organizationId, branchCode?.trim() ?? "", from?.trim(), to?.trim());
  }

  @Get("reports/expired-products")
  @RequirePermissions("pops.read")
  getExpiredProducts(
    @CurrentUser() user: AccessJwtPayload,
    @Query("branchCode") branchCode: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.pharmacy.getExpiredProducts(user.organizationId, branchCode?.trim() ?? "", from?.trim(), to?.trim());
  }
}

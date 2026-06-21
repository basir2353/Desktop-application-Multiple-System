import { z } from "zod";

export const DELIVERY_STATUS_VALUES = [
  "unassigned",
  "assigned",
  "out_for_delivery",
  "delivered",
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUS_VALUES)[number];

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

export const deliveryStatusSchema = z.enum(DELIVERY_STATUS_VALUES);

export const riderSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  cnic: z.string().nullable(),
  salaryPkr: z.number().int().nonnegative().nullable(),
  fromArea: z.string().nullable(),
  notes: z.string().nullable(),
  active: z.boolean(),
});

export const riderListSchema = z.object({
  branchCode: z.string(),
  riders: z.array(riderSchema),
});

export const createRiderSchema = z.object({
  branchCode: z.string().min(1),
  name: z.string().min(1).max(80),
  phone: z.string().max(32).optional(),
  cnic: z.string().max(20).optional(),
  salaryPkr: z.number().int().min(0).optional(),
  fromArea: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
});

export const updateRiderSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  phone: z.string().max(32).nullable().optional(),
  cnic: z.string().max(20).nullable().optional(),
  salaryPkr: z.number().int().min(0).nullable().optional(),
  fromArea: z.string().max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  active: z.boolean().optional(),
});

export const updateDeliveryOrderSchema = z.object({
  riderId: z.string().uuid().nullable().optional(),
  deliveryChargePkr: z.number().int().min(0).max(50_000).optional(),
  deliveryStatus: deliveryStatusSchema.optional(),
});

export type Rider = z.infer<typeof riderSchema>;
export type CreateRider = z.infer<typeof createRiderSchema>;
export type UpdateRider = z.infer<typeof updateRiderSchema>;
export type UpdateDeliveryOrder = z.infer<typeof updateDeliveryOrderSchema>;

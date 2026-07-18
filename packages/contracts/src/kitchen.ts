import { z } from "zod";

import { deliveryStatusSchema } from "./delivery";

export const kitchenTicketStatusSchema = z.enum(["new", "cooking", "ready", "done"]);
export const kitchenTicketPrioritySchema = z.enum(["normal", "priority"]);

export const kitchenTicketLineSchema = z.object({
  label: z.string(),
  qty: z.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative().default(0),
  menuItemId: z.string().uuid().optional(),
});

export const kitchenTicketSchema = z.object({
  id: z.string().uuid(),
  ticketRef: z.string(),
  orderRef: z.string().nullable(),
  stationLabel: z.string(),
  itemsSummary: z.string(),
  lines: z.array(kitchenTicketLineSchema).optional(),
  notes: z.string().nullable().optional(),
  priority: kitchenTicketPrioritySchema,
  status: kitchenTicketStatusSchema,
  mins: z.number().int().nonnegative(),
  startedAt: z.string().nullable(),
  createdAt: z.string(),
  riderId: z.string().uuid().nullable(),
  riderName: z.string().nullable(),
  deliveryChargePkr: z.number(),
  deliveryStatus: deliveryStatusSchema.nullable(),
  /** Waiter/user who took the order. Null for legacy tickets or desktop counter orders. */
  createdById: z.string().uuid().nullable().optional(),
  createdByName: z.string().nullable().optional(),
});

export const kitchenTicketListSchema = z.object({
  branchCode: z.string(),
  tickets: z.array(kitchenTicketSchema),
});

export const createKitchenTicketSchema = z.object({
  branchCode: z.string().min(1),
  orderRef: z.string().max(32).optional(),
  stationLabel: z.string().min(1).max(64),
  lines: z.array(
    z.object({
      label: z.string().min(1),
      qty: z.number().int().positive(),
      unitPrice: z.number().int().nonnegative().optional(),
      menuItemId: z.string().uuid().optional(),
    }),
  ).min(1),
  notes: z.string().max(500).optional(),
  priority: kitchenTicketPrioritySchema.optional(),
  riderId: z.string().uuid().optional(),
  deliveryChargePkr: z.number().int().min(0).max(50_000).optional(),
});

export const updateKitchenTicketSchema = z.object({
  status: kitchenTicketStatusSchema.optional(),
  priority: kitchenTicketPrioritySchema.optional(),
  /** Dine-in table / station label (e.g. "Table T3"). */
  stationLabel: z.string().min(1).max(64).optional(),
  riderId: z.string().uuid().nullable().optional(),
  deliveryChargePkr: z.number().int().min(0).max(50_000).optional(),
  deliveryStatus: deliveryStatusSchema.optional(),
  lines: z
    .array(
      z.object({
        label: z.string().min(1),
        qty: z.number().int().positive(),
        unitPrice: z.number().int().nonnegative().optional(),
        menuItemId: z.string().uuid().optional(),
      }),
    )
    .min(1)
    .optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type KitchenTicket = z.infer<typeof kitchenTicketSchema>;
export type KitchenTicketStatus = z.infer<typeof kitchenTicketStatusSchema>;
export type CreateKitchenTicket = z.infer<typeof createKitchenTicketSchema>;
export type UpdateKitchenTicket = z.infer<typeof updateKitchenTicketSchema>;

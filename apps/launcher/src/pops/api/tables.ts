import {
  branchFloorSchema,
  createRestaurantTableSchema,
  createSeatingSectionSchema,
  restaurantTableSchema,
  seatingSectionSchema,
  updateRestaurantTableSchema,
  updateSeatingSectionSchema,
  type BranchFloor,
  type CreateRestaurantTable,
  type CreateSeatingSection,
  type RestaurantTable,
  type SeatingSection,
  type UpdateRestaurantTable,
  type UpdateSeatingSection,
} from "@platform/contracts";
import { authFetch } from "../../lib/authFetch";

export async function fetchBranchFloor(branchCode: string): Promise<BranchFloor> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/tables?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Tables failed: ${res.status}`);
  }
  return branchFloorSchema.parse(await res.json());
}

export async function fetchBranchFloorAdmin(branchCode: string): Promise<BranchFloor> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/tables/admin?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Tables admin failed: ${res.status}`);
  }
  return branchFloorSchema.parse(await res.json());
}

export async function createSeatingSection(input: CreateSeatingSection): Promise<SeatingSection> {
  const body = createSeatingSectionSchema.parse(input);
  const res = await authFetch("/v1/tables/sections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Create section failed: ${res.status}`);
  }
  return seatingSectionSchema.parse(await res.json());
}

export async function updateSeatingSection(
  sectionId: string,
  input: UpdateSeatingSection,
): Promise<SeatingSection> {
  const body = updateSeatingSectionSchema.parse(input);
  const res = await authFetch(`/v1/tables/sections/${sectionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Update section failed: ${res.status}`);
  }
  return seatingSectionSchema.parse(await res.json());
}

export async function deleteSeatingSection(sectionId: string): Promise<void> {
  const res = await authFetch(`/v1/tables/sections/${sectionId}`, { method: "DELETE" });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Delete section failed: ${res.status}`);
  }
}

export async function createRestaurantTable(input: CreateRestaurantTable): Promise<RestaurantTable> {
  const body = createRestaurantTableSchema.parse(input);
  const res = await authFetch("/v1/tables", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Create table failed: ${res.status}`);
  }
  return restaurantTableSchema.parse(await res.json());
}

export async function updateRestaurantTable(
  tableId: string,
  input: UpdateRestaurantTable,
): Promise<RestaurantTable> {
  const body = updateRestaurantTableSchema.parse(input);
  const res = await authFetch(`/v1/tables/${tableId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Update table failed: ${res.status}`);
  }
  return restaurantTableSchema.parse(await res.json());
}

export async function deleteRestaurantTable(tableId: string): Promise<void> {
  const res = await authFetch(`/v1/tables/${tableId}`, { method: "DELETE" });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Delete table failed: ${res.status}`);
  }
}

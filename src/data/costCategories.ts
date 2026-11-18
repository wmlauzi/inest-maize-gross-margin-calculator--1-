import type { CategoryId } from "../types/index.ts";

/** The eleven standard categories, in workbook order. They can never be removed. */
export const COST_CATEGORIES: readonly { id: CategoryId; name: string }[] = [
  { id: "seed", name: "Seed" },
  { id: "fertiliser", name: "Fertiliser and lime" },
  { id: "herbicides", name: "Herbicides" },
  { id: "insecticides", name: "Insecticides" },
  { id: "growth-regulators", name: "Growth regulators" },
  { id: "labour", name: "Labour" },
  { id: "tractor", name: "Tractor hire and land preparation" },
  { id: "harvesting", name: "Harvesting" },
  { id: "transport", name: "Transport" },
  { id: "irrigation", name: "Irrigation" },
  { id: "other", name: "Other variable costs" },
];

/** The one yield-linked item (workbook Costs row 55). */
export const TRANSPORT_ITEM_ID = "transport-grain";

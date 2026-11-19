import type { AreaUnit, UnitName } from "../types/index.ts";

type AreaRateUnit = Extract<UnitName, "ha" | "acre">;

export interface AreaUnitText {
  unit: AreaUnit;
  unitName: "ha" | "acre";
  pluralUnitName: "ha" | "acres";
  equivalentUnitName: "ha" | "acres";
  rateLabel: string;
  inputHint: string;
  validationMessage: string;
  defaultRateUnit: AreaRateUnit;
  defaultRateUnitLabel: "Ha" | "Acre";
}

const AREA_UNIT_TEXT: Record<AreaUnit, AreaUnitText> = {
  ha: {
    unit: "ha",
    unitName: "ha",
    pluralUnitName: "ha",
    equivalentUnitName: "acres",
    rateLabel: "Rate per ha",
    inputHint: "Enter the quantity or rate per ha",
    validationMessage: "Enter the quantity or rate per ha.",
    defaultRateUnit: "ha",
    defaultRateUnitLabel: "Ha",
  },
  acres: {
    unit: "acres",
    unitName: "acre",
    pluralUnitName: "acres",
    equivalentUnitName: "ha",
    rateLabel: "Rate per acre",
    inputHint: "Enter the quantity or rate per acre",
    validationMessage: "Enter the quantity or rate per acre.",
    defaultRateUnit: "acre",
    defaultRateUnitLabel: "Acre",
  },
};

export function getAreaUnitText(unit: AreaUnit): AreaUnitText {
  return AREA_UNIT_TEXT[unit];
}

export function formatAreaUnitMessage(message: string, unit: AreaUnit): string {
  return message.replace("Enter the quantity or rate.", getAreaUnitText(unit).validationMessage);
}

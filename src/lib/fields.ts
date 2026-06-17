/** Field formatting shared by FieldGroup, Contract Summary, Final Review, etc. */
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

export type FieldType =
  | "text"
  | "mono"
  | "date"
  | "money"
  | "number"
  | "percent"
  | "days"
  | "bool";

export interface Field {
  label: string;
  value: unknown;
  type?: FieldType;
}

export function isEmptyValue(v: unknown): boolean {
  return v === null || v === undefined || v === "" || v === false;
}

export function formatField(v: unknown, type: FieldType = "text"): string {
  if (v === null || v === undefined || v === "") return "—";
  switch (type) {
    case "date":
      return formatDate(v as string);
    case "money":
      return formatMoney(v as number);
    case "percent":
      return `${v}%`;
    case "days":
      return `${formatNumber(v as number)} days`;
    case "number":
      return formatNumber(v as number);
    case "bool":
      return v ? "Yes" : "No";
    default:
      return String(v);
  }
}

/**
 * Brief 24 — material-specific Quantity Ledger descriptor labels. Legacy drives
 * the Desc 1/2/3 column headers off the material's descriptor schema (e.g. sheeting
 * shows Color / Type of Sheeting). Driven by family here (the Materials →
 * Descriptions dictionary, brief 20); a per-material override can be added later.
 */
import type { MaterialFamily } from "./types";

const DESCRIPTOR_LABELS: Record<MaterialFamily, [string, string, string]> = {
  HMA: ["Mix Type", "Course", "PG Grade"],
  Paint: ["Color", "Type of Sheeting", "Sheeting Grade"],
  Concrete: ["Class", "Mix Design", "Slump"],
  Aggregate: ["Gradation", "Source", "Class"],
  Steel: ["Bar Size", "Grade", "Coating"],
  Soil: ["Classification", "Source", "Proctor"],
  Hardware: ["Type", "Size", "Finish"],
  Other: ["Desc 1", "Desc 2", "Desc 3"],
};

export function descriptorLabelsFor(family: MaterialFamily | undefined): [string, string, string] {
  return (family && DESCRIPTOR_LABELS[family]) || ["Desc 1", "Desc 2", "Desc 3"];
}

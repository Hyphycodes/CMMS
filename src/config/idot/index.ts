// IDOT-SPECIFIC — varies by state.
//
// F5 — the labeled config boundary. Everything a *second state* would supply is
// reachable here (and only here). This is a boundary, NOT an abstraction: there
// is one config (`idotConfig`); no generic schema, no second state. A
// `git grep "IDOT-SPECIFIC"` enumerates exactly what a new state must provide.
import type { AuthType } from "@/domain/types";
// The code sets live in the reference data layer; the boundary surfaces them so a
// second state has a single place to look — it does not duplicate them.
import { EOI_CODES, MOA_CODES, INSPECTION_TYPES } from "@/data/reference";

export { EOI_CODES, MOA_CODES, INSPECTION_TYPES };

/** Fund keys (MISTIC). */
export const FUND_KEYS = ["FED-STP", "STATE-01", "LOCAL-A", "FED-NHPP", "STATE-BR"] as const;

/** Authorization approval chains by type (Ch. 7). */
export const AUTH_STEPS: Record<AuthType, string[]> = {
  Standard: ["Resident Engineer", "District Construction"],
  "Overage/Balancing": ["Resident Engineer", "District Construction", "Bureau of Construction"],
  "Major Change": ["Resident Engineer", "District Construction", "Bureau of Construction", "FHWA"],
};

/** Specification years offered in setup / summary. */
export const SPEC_YEARS = ["2016", "2020", "2022", "2024"] as const;

/**
 * The single active configuration. Code reads `activeConfig.fundKeys`,
 * `activeConfig.authSteps`, etc. — never the raw constants directly.
 */
export const idotConfig = {
  state: "IDOT" as const,
  fundKeys: FUND_KEYS,
  authSteps: AUTH_STEPS,
  eoiCodes: EOI_CODES,
  moaCodes: MOA_CODES,
  inspectionTypes: INSPECTION_TYPES,
  specYears: SPEC_YEARS,
};

export type ActiveConfig = typeof idotConfig;

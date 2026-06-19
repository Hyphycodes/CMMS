/**
 * F5 — config boundary. `activeConfig` is the one place state-specific reference
 * + workflow constants are reached from. Today it is IDOT; a second state would
 * be a new `src/config/<state>/` supplying the same shape (see the IDOT-SPECIFIC
 * markers) and a one-line switch here — no core refactor.
 */
export { idotConfig as activeConfig, type ActiveConfig } from "./idot";
export { FUND_KEYS, AUTH_STEPS, EOI_CODES, MOA_CODES, INSPECTION_TYPES, SPEC_YEARS } from "./idot";

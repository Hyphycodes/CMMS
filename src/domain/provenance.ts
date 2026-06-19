/**
 * F2 — Provenance + party stamping, centralized.
 *
 * Every mutable record carries who/which-org/when + an incrementing version.
 * Stamping flows through `stamp()` so no action hand-sets these fields
 * (`git grep "updatedBy:"` should only hit this file + seeds). The party
 * dimension rides along on the actor's org so external contractors / producers /
 * labs can be invited in later without re-stamping the dataset.
 */
import type { Provenance, User } from "./types";

export interface Stamper {
  userName: string;
  orgId: string;
}

export function stamperFromUser(user: User | undefined): Stamper {
  return { userName: user?.name ?? "system", orgId: user?.orgId ?? "IDOT" };
}

/**
 * Return a copy of `entity` with provenance fields set: `createdBy*` once (on
 * first insert), `updatedBy*` + `version` bumped every time. `now` is injectable
 * for deterministic tests; defaults to today's ISO date.
 */
export function stamp<T extends Provenance>(
  entity: T,
  by: Stamper,
  opts: { isNew?: boolean; now?: string } = {},
): T {
  const now = opts.now ?? new Date().toISOString();
  const isNew = opts.isNew ?? !entity.createdAt;
  return {
    ...entity,
    createdBy: isNew ? by.userName : entity.createdBy ?? by.userName,
    createdByOrg: isNew ? by.orgId : entity.createdByOrg ?? by.orgId,
    createdAt: isNew ? now : entity.createdAt ?? now,
    updatedBy: by.userName,
    updatedByOrg: by.orgId,
    updatedAt: now,
    version: (entity.version ?? 0) + 1,
  };
}

/** A short "edited by X on date" string for record headers / history. */
export function provenanceLabel(p: Provenance): string {
  if (!p.updatedBy && !p.createdBy) return "";
  const who = p.updatedBy ?? p.createdBy ?? "";
  const when = (p.updatedAt ?? p.createdAt ?? "").slice(0, 10);
  return when ? `${who} · ${when}` : who;
}

/**
 * Demo users for local mode, derived deterministically from the loaded world so
 * each role's scope shows real work. Replaced by Supabase Auth in brief 12 (the
 * dev role-switcher previews these). Documentation/Admin carry districts;
 * Inspector/RE/Contractor carry explicit contracts.
 */
import type { Contract, InventoryItem, User } from "@/domain/types";

export function buildDemoUsers(contracts: Contract[], items: InventoryItem[]): User[] {
  const readyByDistrict = new Map<number, number>();
  const readyByContract = new Map<string, number>();
  const openByContract = new Map<string, number>();
  const districtOf = new Map(contracts.map((c) => [c.id, c.district]));

  for (const it of items) {
    if (it.status === "Ready for Review") {
      readyByContract.set(it.contractId, (readyByContract.get(it.contractId) ?? 0) + 1);
      const d = districtOf.get(it.contractId);
      if (d) readyByDistrict.set(d, (readyByDistrict.get(d) ?? 0) + 1);
    } else if (it.status === "Needs Attention") {
      openByContract.set(it.contractId, (openByContract.get(it.contractId) ?? 0) + 1);
    }
  }

  const allDistricts = [...new Set(contracts.map((c) => c.district))].sort((a, b) => a - b);
  const topDistricts = [...readyByDistrict.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([d]) => d);

  // contracts with the most "in-flight" inventory make the best demo scope
  const byActivity = [...contracts]
    .map((c) => ({
      c,
      score: (readyByContract.get(c.id) ?? 0) + (openByContract.get(c.id) ?? 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);

  const inspectorContracts = byActivity.slice(0, 6).map((c) => c.id);
  const reContracts = byActivity.slice(0, 8).map((c) => c.id);
  const contractorContracts = byActivity.slice(0, 2).map((c) => c.id);

  return [
    {
      id: "u_admin",
      name: "D. Schwartz",
      roles: ["DistrictAdmin"],
      districtIds: allDistricts,
      contractIds: [],
    },
    {
      id: "u_doc",
      name: "L. Whitfield",
      roles: ["Documentation"],
      districtIds: topDistricts,
      contractIds: [],
    },
    {
      id: "u_inspector",
      name: "C. Okafor",
      roles: ["Inspector"],
      districtIds: [],
      contractIds: inspectorContracts,
    },
    {
      id: "u_re",
      name: "A. Calloway",
      roles: ["ResidentEngineer"],
      districtIds: [],
      contractIds: reContracts,
    },
    {
      id: "u_contractor",
      name: "Prairie State Construction",
      roles: ["Contractor"],
      districtIds: [],
      contractIds: contractorContracts,
    },
  ];
}

export const DEFAULT_USER_ID = "u_doc";

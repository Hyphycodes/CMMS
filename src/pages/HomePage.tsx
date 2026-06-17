/**
 * Home — a clean, searchable list of all contracts the user can access. No
 * status badges, counts, or task actions live here: the home page is purely for
 * browsing/searching contracts. Status workflows (Ready for Review, Needs
 * Attention, …) live INSIDE each contract's Inventory tab.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { useStore } from "@/store/store";
import { DataGrid } from "@/components/ui/DataGrid";
import type { Contract } from "@/domain/types";

const columns: ColumnDef<Contract>[] = [
  {
    id: "number",
    accessorKey: "number",
    header: "Contract ID",
    size: 120,
    cell: ({ getValue }) => (
      <span className="font-mono text-[13px] font-semibold text-accent">{getValue() as string}</span>
    ),
  },
  {
    id: "name",
    accessorKey: "name",
    header: "Name",
    size: 360,
    meta: { grow: true },
    cell: ({ getValue }) => <span className="text-ink">{getValue() as string}</span>,
  },
  { id: "county", accessorKey: "county", header: "County", size: 140 },
  {
    id: "district",
    accessorKey: "district",
    header: "District",
    size: 90,
    meta: { align: "right" },
    cell: ({ getValue }) => <span className="tabular-nums">{getValue() as number}</span>,
  },
  { id: "workType", accessorKey: "workType", header: "Work Type", size: 220 },
];

export function HomePage() {
  const allContracts = useStore((s) => s.contracts);
  const visibleIds = useStore((s) => s.visibleIds);
  const navigate = useNavigate();

  const contracts = useMemo(
    () => allContracts.filter((c) => visibleIds.has(c.id)),
    [allContracts, visibleIds],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-6">
        <h1 className="text-lg font-semibold text-ink">Contracts</h1>
        <p className="text-xs text-ink-soft">Browse and search your contracts.</p>
      </div>

      <div className="min-h-0 flex-1">
        <DataGrid
          data={contracts}
          columns={columns}
          getRowId={(c) => c.id}
          toolbar
          searchable
          searchPlaceholder="Search by contract ID, name, county, or work type…"
          countLabel="contracts"
          globalSearchText={(c) => `${c.number} ${c.name} ${c.county} ${c.workType} ${c.district}`}
          onRowClick={(c) => navigate(`/contract/${c.id}`)}
          emptyMessage="No contracts in your scope."
        />
      </div>
    </div>
  );
}

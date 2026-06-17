/**
 * Materials admin surfaces (brief 11) — Material Definition, Vendors, Mix Design.
 * Global (no contract scope). Each reuses DataGrid; the material picker that
 * powers samples/inventory/quantity-book is the one IntelligentSearch (brief 01).
 */
import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useStore } from "@/store/store";
import { MATERIALS, PRODUCERS, SUPPLIERS } from "@/data/reference";
import type { Material, MixDesign } from "@/domain/types";
import { DataGrid } from "@/components/ui/DataGrid";
import { Pill } from "@/components/ui/Pill";

function PageShell({ title, subtitle, children, action }: { title: string; subtitle: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-line bg-surface px-5 py-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">{title}</h1>
          <p className="text-xs text-ink-soft">{subtitle}</p>
        </div>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export function MaterialDefinitionPage() {
  const columns: ColumnDef<Material>[] = [
    { id: "code", accessorKey: "code", header: "Material Code", size: 120, cell: ({ getValue }) => <span className="font-mono text-[13px] font-semibold">{getValue() as string}</span> },
    { id: "name", accessorKey: "name", header: "Material Name", size: 240, meta: { grow: true } },
    { id: "unit", accessorKey: "unit", header: "UOM", size: 90 },
    { id: "moa", accessorKey: "moa", header: "MOA", size: 90 },
    { id: "eoi", accessorFn: (m) => m.acceptableEoi.join(" · "), header: "Acceptable EOI", size: 180, cell: ({ row }) => <span className="font-mono text-[12px] text-ink-soft">{row.original.acceptableEoi.join(" · ")}</span> },
    { id: "family", accessorKey: "family", header: "Family", size: 110 },
    { id: "cf", accessorKey: "conversionFactor", header: "Conversion Factor", size: 140, meta: { align: "right" } },
  ];
  return (
    <PageShell title="Material Definition" subtitle="Master Material Code Listing — drives inventory MOA + EOI and test templates.">
      <DataGrid
        data={MATERIALS}
        columns={columns}
        getRowId={(m) => m.code}
        toolbar
        searchable
        searchPlaceholder="Filter by code, name, family…"
        countLabel="materials"
        globalSearchText={(m) => `${m.code} ${m.name} ${m.family} ${m.moa} ${m.unit}`}
        emptyMessage="No materials."
      />
    </PageShell>
  );
}

type VendorRow = { number: string; name: string; city: string; state: string; kind: "Producer" | "Supplier" };

export function VendorsPage() {
  const rows = useMemo<VendorRow[]>(
    () => [
      ...PRODUCERS.map((v) => ({ ...v, kind: "Producer" as const })),
      ...SUPPLIERS.map((v) => ({ ...v, kind: "Supplier" as const })),
    ],
    [],
  );
  const columns: ColumnDef<VendorRow>[] = [
    { id: "number", accessorKey: "number", header: "Number", size: 110, cell: ({ getValue }) => <span className="font-mono text-[13px]">{getValue() as string}</span> },
    { id: "name", accessorKey: "name", header: "Name", size: 260, meta: { grow: true } },
    { id: "city", accessorKey: "city", header: "City", size: 150 },
    { id: "state", accessorKey: "state", header: "State", size: 80 },
    { id: "kind", accessorKey: "kind", header: "Type", size: 110, cell: ({ row }) => <Pill tone={row.original.kind === "Producer" ? "blue" : "slate"}>{row.original.kind}</Pill> },
  ];
  return (
    <PageShell title="Vendors" subtitle="Producers + suppliers — number, name, location. Check effective date when a material+producer pairing isn't found.">
      <DataGrid
        data={rows}
        columns={columns}
        getRowId={(v) => `${v.kind}:${v.number}`}
        toolbar
        searchable
        searchPlaceholder="Filter vendors by number, name, city…"
        countLabel="vendors"
        globalSearchText={(v) => `${v.number} ${v.name} ${v.city} ${v.state} ${v.kind}`}
        emptyMessage="No vendors."
      />
    </PageShell>
  );
}

export function MixDesignPage() {
  const mixDesigns = useStore((s) => s.mixDesignsList);
  const pushToast = useStore((s) => s.pushToast);
  const columns: ColumnDef<MixDesign>[] = [
    { id: "number", accessorKey: "number", header: "Mix Design", size: 140, cell: ({ getValue }) => <span className="font-mono text-[13px] font-semibold">{getValue() as string}</span> },
    { id: "materialCode", accessorKey: "materialCode", header: "Material Code", size: 130, cell: ({ getValue }) => <span className="font-mono text-[13px]">{getValue() as string}</span> },
    { id: "family", accessorKey: "family", header: "Family", size: 120 },
    { id: "producer", accessorKey: "producer", header: "Producer", size: 240, meta: { grow: true } },
    { id: "approved", accessorFn: (m) => (m.approved ? "Approved" : "Pending"), header: "Status", size: 120, cell: ({ row }) => <Pill tone={row.original.approved ? "green" : "amber"}>{row.original.approved ? "Approved" : "Pending"}</Pill> },
  ];
  return (
    <PageShell
      title="Mix Design"
      subtitle="HMA / PCC mix designs — feed the inventory ledger Mix Design field and HMA/PCC samples."
      action={
        <button onClick={() => pushToast("info", "Mix design upload + storage lands in brief 12.")} className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover">
          + Upload Mix Design
        </button>
      }
    >
      <DataGrid
        data={mixDesigns}
        columns={columns}
        getRowId={(m) => m.number}
        toolbar
        searchable
        searchPlaceholder="Filter by mix design, material, producer…"
        countLabel="mix designs"
        globalSearchText={(m) => `${m.number} ${m.materialCode} ${m.family} ${m.producer}`}
        emptyMessage="No mix designs."
      />
    </PageShell>
  );
}

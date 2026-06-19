/**
 * Materials admin surfaces (brief 11) — Material Definition, Vendors, Mix Design.
 * Global (no contract scope). Each reuses DataGrid; the material picker that
 * powers samples/inventory/quantity-book is the one IntelligentSearch (brief 01).
 */
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useStore } from "@/store/store";
import { MATERIALS, VENDORS } from "@/data/reference";
import type { Material, MixDesign, Vendor } from "@/domain/types";
import { DataGrid } from "@/components/ui/DataGrid";
import { Pill } from "@/components/ui/Pill";
import { FileDrop } from "@/components/ui/FileDrop";

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
    { id: "eoi", accessorFn: (m) => m.acceptableEoi.join(" · "), header: "Acceptable EOI", size: 160, cell: ({ row }) => <span className="font-mono text-[12px] text-ink-soft">{row.original.acceptableEoi.join(" · ")}</span> },
    { id: "family", accessorKey: "family", header: "Family", size: 100 },
    { id: "group", accessorFn: (m) => m.group ?? "", header: "Group", size: 130, cell: ({ getValue }) => (getValue() as string) || "—" },
    { id: "cf", accessorKey: "conversionFactor", header: "Conv. Factor", size: 110, meta: { align: "right" } },
    { id: "babaDsa", accessorFn: (m) => m.babaDsa ?? "", header: "BABA/DSA", size: 100, cell: ({ getValue }) => (getValue() as string) || "—" },
    { id: "sampleSize", accessorFn: (m) => m.sampleSize ?? "", header: "Sample Size", size: 220, cell: ({ getValue }) => <span className="truncate text-[12px] text-ink-soft" title={getValue() as string}>{(getValue() as string) || "—"}</span> },
    { id: "specs", accessorFn: (m) => m.specifications ?? "", header: "Specifications", size: 260, meta: { grow: true }, cell: ({ getValue }) => <span className="truncate text-[12px] text-ink-soft" title={getValue() as string}>{(getValue() as string) || "—"}</span> },
  ];
  return (
    <PageShell title="Material Definition" subtitle="Master Material Code Listing (MMI CMMS Part 3, 3/13/2026) — drives inventory MOA + EOI and test templates.">
      <DataGrid
        data={MATERIALS}
        columns={columns}
        getRowId={(m) => m.code}
        minWidth={1700}
        toolbar
        searchable
        searchPlaceholder="Filter by code, name, family, MOA…"
        countLabel="materials"
        globalSearchText={(m) => `${m.code} ${m.name} ${m.family} ${m.moa} ${m.unit} ${m.group ?? ""} ${m.specifications ?? ""}`}
        emptyMessage="No materials."
      />
    </PageShell>
  );
}

export function VendorsPage() {
  const columns: ColumnDef<Vendor>[] = [
    { id: "number", accessorKey: "number", header: "Number", size: 110, cell: ({ getValue }) => <span className="font-mono text-[13px]">{getValue() as string}</span> },
    { id: "name", accessorKey: "name", header: "Name", size: 260, meta: { grow: true } },
    { id: "city", accessorKey: "city", header: "City", size: 150 },
    { id: "state", accessorKey: "state", header: "State", size: 70 },
    { id: "category", accessorFn: (v) => v.category ?? "", header: "Category", size: 110, cell: ({ getValue }) => <span className="font-mono text-[12px] text-ink-soft">{(getValue() as string) || "—"}</span> },
    { id: "district", accessorFn: (v) => v.district ?? "", header: "District", size: 90, cell: ({ getValue }) => (getValue() as string) || "—" },
    { id: "active", accessorFn: (v) => (v.active === false ? "Inactive" : "Active"), header: "Status", size: 110, cell: ({ row }) => <Pill tone={row.original.active === false ? "slate" : "green"}>{row.original.active === false ? "Inactive" : "Active"}</Pill> },
  ];
  return (
    <PageShell title="Vendors" subtitle="MISTIC Producer/Supplier master (5/22/26) — a vendor serves as producer or supplier. Active records by default; inactive shown for history.">
      <DataGrid
        data={VENDORS}
        columns={columns}
        getRowId={(v) => v.number}
        toolbar
        searchable
        searchPlaceholder="Filter vendors by number, name, city, category…"
        countLabel="vendors"
        globalSearchText={(v) => `${v.number} ${v.name} ${v.city} ${v.state} ${v.category ?? ""}`}
        emptyMessage="No vendors."
      />
    </PageShell>
  );
}

export function MixDesignPage() {
  const mixDesigns = useStore((s) => s.mixDesignsList);
  const [selected, setSelected] = useState<MixDesign | null>(null);
  const columns: ColumnDef<MixDesign>[] = [
    { id: "number", accessorKey: "number", header: "Mix Design", size: 140, cell: ({ getValue }) => <span className="font-mono text-[13px] font-semibold">{getValue() as string}</span> },
    { id: "materialCode", accessorKey: "materialCode", header: "Material Code", size: 130, cell: ({ getValue }) => <span className="font-mono text-[13px]">{getValue() as string}</span> },
    { id: "family", accessorKey: "family", header: "Family", size: 120 },
    { id: "producer", accessorKey: "producer", header: "Producer", size: 240, meta: { grow: true } },
    { id: "approved", accessorFn: (m) => (m.approved ? "Approved" : "Pending"), header: "Status", size: 120, cell: ({ row }) => <Pill tone={row.original.approved ? "green" : "amber"}>{row.original.approved ? "Approved" : "Pending"}</Pill> },
    {
      id: "docs",
      header: "Mix Design Doc",
      size: 150,
      cell: ({ row }) => (
        <button
          onClick={() => setSelected(row.original)}
          className="rounded-md border border-line px-2 py-0.5 text-xs font-medium text-accent hover:bg-canvas"
        >
          Documents
        </button>
      ),
    },
  ];
  return (
    <PageShell
      title="Mix Design"
      subtitle="HMA / PCC mix designs — feed the inventory ledger Mix Design field and HMA/PCC samples."
    >
      {selected && (
        <div className="mb-3 rounded-xl border border-line bg-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-ink">
              Documents for <span className="font-mono">{selected.number}</span> · {selected.producer}
            </div>
            <button onClick={() => setSelected(null)} className="text-xs text-ink-faint hover:text-ink">
              Close
            </button>
          </div>
          <FileDrop scope={{ entity: "mixDesign", entityId: selected.number }} label="Upload mix design" />
        </div>
      )}
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

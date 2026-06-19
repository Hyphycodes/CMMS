/**
 * Brief 20 — Materials menu surfaces (Tier 1, built real):
 *   Inventory (cross-contract search) · Acceptance (reviewer queue at material
 *   level) · Inspectors · Laboratory · Descriptions (material-descriptor dict).
 * All are pure reads over the in-memory world (selectors), virtualized via DataGrid.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { useStore } from "@/store/store";
import { MATERIALS } from "@/data/reference";
import type { InventoryItem, Material } from "@/domain/types";
import { DataGrid } from "@/components/ui/DataGrid";
import { Pill } from "@/components/ui/Pill";
import { inventoryTone } from "@/domain/status";
import { ROLE_LABELS } from "@/auth/permissions";
import { formatWaiting, waitingTone } from "@/lib/format";

function PageShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 px-6 py-6">
        <div>
          <h1 className="text-lg font-semibold text-ink">{title}</h1>
          <p className="text-sm text-ink-soft">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

// --- Materials → Inventory (cross-contract search) -------------------------

export function MaterialsInventoryPage() {
  const navigate = useNavigate();
  const items = useStore((s) => s.items);
  const visibleIds = useStore((s) => s.visibleIds);
  const data = useMemo(() => items.filter((i) => visibleIds.has(i.contractId)), [items, visibleIds]);

  const columns: ColumnDef<InventoryItem>[] = [
    { id: "contract", accessorKey: "contractNumber", header: "Contract", size: 100, cell: ({ getValue }) => <span className="font-mono text-[13px] font-semibold">{getValue() as string}</span> },
    { id: "inventoryId", accessorKey: "inventoryId", header: "Inventory ID", size: 110, cell: ({ getValue }) => <span className="font-mono text-[12px] text-ink-soft">{getValue() as string}</span> },
    { id: "material", accessorFn: (r) => `${r.materialCode} ${r.materialName}`, header: "Material", size: 280, meta: { grow: true }, cell: ({ row }) => (<span><span className="font-mono text-[13px] font-semibold">{row.original.materialCode}</span> <span className="text-ink-soft">{row.original.materialName}</span></span>) },
    { id: "producer", accessorFn: (r) => r.producerName, header: "Producer", size: 200 },
    { id: "status", accessorKey: "status", header: "Status", size: 150, cell: ({ row }) => <Pill tone={inventoryTone(row.original.status)}>{row.original.status ?? "—"}</Pill> },
  ];

  return (
    <PageShell title="Inventory — materials-wide" subtitle="Locate any inventory across every contract in your scope. Distinct from the review Inbox.">
      <div className="h-[calc(100vh-180px)]">
        <DataGrid
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          toolbar
          searchable
          searchPlaceholder="Search material, producer, contract, inventory ID…"
          countLabel="inventory items"
          globalSearchText={(r) => `${r.contractNumber} ${r.inventoryId} ${r.materialCode} ${r.materialName} ${r.producerName} ${r.supplierName}`}
          onRowClick={(r) => navigate(`/contract/${r.contractId}/inventory/${r.id}`)}
          emptyMessage="No inventory in scope."
        />
      </div>
    </PageShell>
  );
}

// --- Materials → Acceptance (reviewer queue at material level) -------------

interface AcceptRow extends InventoryItem {
  contractNumber: string;
  waitingMs: number;
}

export function MaterialsAcceptancePage() {
  const navigate = useNavigate();
  const items = useStore((s) => s.items);
  const visibleIds = useStore((s) => s.visibleIds);
  const now = Date.now();
  const queue = useMemo<AcceptRow[]>(
    () =>
      items
        .filter((i) => i.status === "Ready for Review" && visibleIds.has(i.contractId))
        .map((i) => ({ ...i, waitingMs: i.readyAt ? now - i.readyAt : 0 }))
        .sort((a, b) => (a.readyAt ?? 0) - (b.readyAt ?? 0)),
    [items, visibleIds, now],
  );

  const columns: ColumnDef<AcceptRow>[] = [
    { id: "contract", accessorFn: (r) => r.contractNumber, header: "Contract", size: 100, cell: ({ row }) => <span className="font-mono text-[13px] font-semibold">{row.original.contractNumber}</span> },
    { id: "material", accessorFn: (r) => `${r.materialCode} ${r.materialName}`, header: "Material", size: 280, meta: { grow: true }, cell: ({ row }) => (<span><span className="font-mono text-[13px] font-semibold">{row.original.materialCode}</span> <span className="text-ink-soft">{row.original.materialName}</span></span>) },
    { id: "producer", accessorFn: (r) => r.producerName, header: "Producer", size: 190 },
    { id: "waiting", accessorFn: (r) => r.waitingMs, header: "Waiting", size: 120, cell: ({ row }) => <Pill tone={waitingTone(row.original.waitingMs)}>{formatWaiting(row.original.waitingMs)}</Pill> },
    { id: "go", header: "", size: 90, cell: ({ row }) => <button onClick={() => navigate(`/contract/${row.original.contractId}/inventory/${row.original.id}`)} className="text-xs font-medium text-accent hover:underline">Review →</button> },
  ];

  return (
    <PageShell title="Acceptance" subtitle="The reviewer acceptance queue at material level — everything waiting on EOI / Pay Item Materials review, oldest first.">
      <div className="h-[calc(100vh-180px)]">
        <DataGrid
          data={queue}
          columns={columns}
          getRowId={(r) => r.id}
          toolbar
          searchable
          searchPlaceholder="Search material, producer, contract…"
          countLabel="awaiting acceptance"
          globalSearchText={(r) => `${r.contractNumber} ${r.materialCode} ${r.materialName} ${r.producerName}`}
          emptyMessage="Nothing awaiting acceptance in your scope."
        />
      </div>
    </PageShell>
  );
}

// --- Materials → Inspectors ------------------------------------------------

export function InspectorsPage() {
  const users = useStore((s) => s.users);
  const inspectors = useMemo(() => users.filter((u) => u.roles.some((r) => r === "Inspector" || r === "ResidentEngineer")), [users]);

  return (
    <PageShell title="Inspectors" subtitle="The inspector roster and their assigned scope.">
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-canvas text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2 text-right">Assigned Contracts</th>
            </tr>
          </thead>
          <tbody>
            {inspectors.map((u) => (
              <tr key={u.id} className="border-t border-line/70">
                <td className="px-4 py-2 font-medium text-ink">{u.name}</td>
                <td className="px-4 py-2 text-ink-soft">{ROLE_LABELS[u.roles[0]]}</td>
                <td className="px-4 py-2 text-ink-soft">{u.title ?? "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{u.contractIds.length || (u.districtIds.length ? "District-wide" : 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

// --- Materials → Laboratory ------------------------------------------------

export function LaboratoryPage() {
  const samplesList = useStore((s) => s.samplesList);
  const visibleIds = useStore((s) => s.visibleIds);
  const labs = useMemo(() => {
    const samples = samplesList.filter((s) => s.contractId === null || visibleIds.has(s.contractId));
    const map = new Map<string, { lab: string; samples: number; approved: number }>();
    for (const s of samples) {
      const key = s.responsibleLab || "—";
      const e = map.get(key) ?? { lab: key, samples: 0, approved: 0 };
      e.samples++;
      if (s.status === "Approved") e.approved++;
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => b.samples - a.samples);
  }, [samplesList, visibleIds]);

  return (
    <PageShell title="Laboratory" subtitle="Responsible labs and their sample/test load, derived from the Samples records.">
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-canvas text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              <th className="px-4 py-2">Laboratory</th>
              <th className="px-4 py-2 text-right">Samples</th>
              <th className="px-4 py-2 text-right">Approved</th>
            </tr>
          </thead>
          <tbody>
            {labs.map((l) => (
              <tr key={l.lab} className="border-t border-line/70">
                <td className="px-4 py-2 font-medium text-ink">{l.lab}</td>
                <td className="px-4 py-2 text-right tabular-nums">{l.samples}</td>
                <td className="px-4 py-2 text-right tabular-nums">{l.approved}</td>
              </tr>
            ))}
            {labs.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-4 text-center text-ink-faint">No lab records.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

// --- Materials → Descriptions (material-descriptor dictionary) -------------

export function DescriptionsPage() {
  const columns: ColumnDef<Material>[] = [
    { id: "code", accessorKey: "code", header: "Code", size: 110, cell: ({ getValue }) => <span className="font-mono text-[13px] font-semibold">{getValue() as string}</span> },
    { id: "name", accessorKey: "name", header: "Material", size: 240, meta: { grow: true } },
    { id: "family", accessorKey: "family", header: "Family", size: 110 },
    { id: "unit", accessorKey: "unit", header: "Unit", size: 80 },
    { id: "group", accessorFn: (m) => m.group ?? "", header: "Group", size: 90 },
    { id: "specialId", accessorFn: (m) => m.specialId ?? "", header: "Special ID", size: 110 },
    { id: "moa", accessorKey: "moa", header: "MOA", size: 90 },
    { id: "eoi", accessorFn: (m) => m.acceptableEoi.join(" · "), header: "Acceptable EOI", size: 200 },
  ];
  return (
    <PageShell title="Descriptions" subtitle="The material-descriptor dictionary — drives the per-material Quantity Ledger descriptor columns.">
      <div className="h-[calc(100vh-180px)]">
        <DataGrid
          data={MATERIALS}
          columns={columns}
          getRowId={(m) => m.code}
          toolbar
          searchable
          searchPlaceholder="Search material code, name, family, group…"
          countLabel="materials"
          globalSearchText={(m) => `${m.code} ${m.name} ${m.family} ${m.group ?? ""} ${m.specialId ?? ""}`}
          emptyMessage="No materials."
        />
      </div>
    </PageShell>
  );
}

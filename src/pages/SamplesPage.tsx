/**
 * Global Samples surface (brief 03). Virtualized grid of the viewer's samples,
 * Add Sample (Log In Samples) form, and a row-click detail drawer (with the
 * Tests tab from brief 04). Lives under the global Materials nav.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "@/store/store";
import { DataGrid } from "@/components/ui/DataGrid";
import { ContextMenu, type MenuItem } from "@/components/ui/ContextMenu";
import { sampleColumns, type SampleRow } from "@/components/samples/columns";
import { SampleForm } from "@/components/samples/SampleForm";
import { SampleDetailDrawer } from "@/components/samples/SampleDetailDrawer";
import { PlusIcon } from "@/components/ui/icons";

export function SamplesPage() {
  const { sampleId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const samplesList = useStore((s) => s.samplesList);
  const visibleIds = useStore((s) => s.visibleIds);
  const contractsById = useStore((s) => s.contractsById);
  const currentUser = useStore((s) => s.currentUser);
  const canCreate = useStore((s) => s.can("create_sample"));
  const approveSample = useStore((s) => s.approveSample);
  const pushToast = useStore((s) => s.pushToast);
  const [menu, setMenu] = useState<{ x: number; y: number; row: SampleRow } | null>(null);

  // The Samples list shows only the current inspector's own samples. Documentation
  // / Admin (cross-contract reviewers) instead see everything in their scope.
  const inspectorView =
    !!currentUser?.roles.includes("Inspector") &&
    !currentUser.roles.includes("Documentation") &&
    !currentUser.roles.includes("DistrictAdmin");

  const rows = useMemo<SampleRow[]>(
    () =>
      samplesList
        .filter((s) =>
          inspectorView
            ? s.inspector === currentUser?.name
            : s.contractId === null || visibleIds.has(s.contractId),
        )
        .map((s) => ({
          ...s,
          contractNumber: s.contractId ? (contractsById.get(s.contractId)?.number ?? "") : "",
        })),
    [samplesList, visibleIds, contractsById, inspectorView, currentUser],
  );

  // Approval is right-click only (no buttons in the toolbar or the detail page).
  const menuItems = (row: SampleRow): MenuItem[] => [
    { label: "Open details", onClick: () => navigate(`/samples/${row.id}`) },
    { separator: true, label: "" },
    { label: "Approve", onClick: () => approveSample(row.id, { approve: true }) },
    {
      label: "Approve as Exception",
      onClick: () => {
        const note = window.prompt("Reason for exception:")?.trim();
        if (note) approveSample(row.id, { approve: true, note: `Approved as Exception — ${note}` });
      },
    },
    {
      label: "Reject",
      danger: true,
      onClick: () => {
        const note = window.prompt("Reason for rejection:")?.trim();
        if (note) approveSample(row.id, { approve: false, note });
      },
    },
  ];

  const isNew = params.get("new") === "1";
  const closeForm = () => {
    const next = new URLSearchParams(params);
    next.delete("new");
    setParams(next, { replace: true });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Samples</h1>
          <p className="text-xs text-ink-soft">Master sample &amp; Test ID log — the tested-material path.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => pushToast("info", "Import runs through the validated dry-run importer (brief 12).")}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink transition hover:bg-canvas"
          >
            Import
          </button>
          <button
            onClick={() => {
              if (!canCreate) return pushToast("error", "Your role can't create samples.");
              const next = new URLSearchParams(params);
              next.set("new", "1");
              setParams(next, { replace: true });
            }}
            disabled={!canCreate}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusIcon className="text-base" /> Add Sample
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <DataGrid
          data={rows}
          columns={sampleColumns}
          getRowId={(r) => r.id}
          minWidth={2700}
          toolbar
          searchable
          searchPlaceholder="Filter by identifier, material, producer, contract…"
          countLabel="samples"
          globalSearchText={(r) =>
            `${r.sampleIdentifier} ${r.testId} ${r.materialCode} ${r.materialName} ${r.producerName} ${r.supplierName} ${r.inspector} ${r.contractNumber}`
          }
          onRowClick={(r) => navigate(`/samples/${r.id}`)}
          onRowContextMenu={(e, r) => {
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY, row: r });
          }}
          emptyMessage="No samples to display."
        />
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.row)} onClose={() => setMenu(null)} />
      )}

      {isNew && (
        <SampleForm
          onClose={closeForm}
          onSaved={(id) => {
            closeForm();
            navigate(`/samples/${id}`);
          }}
        />
      )}
      {sampleId && <SampleDetailDrawer sampleId={sampleId} onClose={() => navigate("/samples")} />}
    </div>
  );
}

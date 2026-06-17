/**
 * Create / edit an inventory (brief 05). Material/producer/supplier via
 * IntelligentSearch; MOA + Acceptable EOI resolve from the material; the
 * inventory name auto-builds (contract + material + producer). Writes through
 * the optimistic upsertInventoryItem mutation.
 */
import { useMemo, useState } from "react";
import { useStore } from "@/store/store";
import { MATERIALS, PRODUCERS, SUPPLIERS } from "@/data/reference";
import type { InventoryItem } from "@/domain/types";
import { IntelligentSearch } from "@/components/ui/IntelligentSearch";
import { XIcon } from "@/components/ui/icons";

const LOCATION_TYPES = ["Jobsite", "Manufacturer's Plant", "Stockpile", "Storage Yard"] as const;

export function InventoryForm({
  contractId,
  item,
  initialMaterialCode,
  initialPayItem,
  onClose,
  onSaved,
}: {
  contractId: string;
  item?: InventoryItem;
  initialMaterialCode?: string;
  initialPayItem?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const contract = useStore((s) => s.contract(contractId));
  const items = useStore((s) => s.items);
  const payItems = useStore((s) => s.payItemsFor(contractId));
  const upsertInventoryItem = useStore((s) => s.upsertInventoryItem);
  const pushToast = useStore((s) => s.pushToast);

  const nextInventoryId = useMemo(() => {
    let max = 100000;
    for (const i of items) {
      const n = Number(i.inventoryId);
      if (!Number.isNaN(n) && n > max) max = n;
    }
    return max + 1;
  }, [items]);

  const [d, setD] = useState<InventoryItem>(() => {
    if (item) return item;
    const m = initialMaterialCode ? MATERIALS.find((x) => x.code === initialMaterialCode) : undefined;
    return {
      id: "",
      inventoryId: "",
      contractId,
      contractNumber: contract?.number ?? "",
      materialCode: m?.code ?? "",
      materialName: m?.name ?? "",
      materialUnit: m?.unit ?? "",
      producerNumber: "",
      producerName: "",
      supplierNumber: "",
      supplierName: "",
      status: "Needs Attention",
      note: "",
      payItemNumbers: initialPayItem ? [initialPayItem] : [],
      readyAt: null,
      locationType: "Jobsite",
      effectiveDate: null,
      expirationDate: null,
    };
  });
  const patch = (p: Partial<InventoryItem>) => setD((cur) => ({ ...cur, ...p }));

  const material = MATERIALS.find((m) => m.code === d.materialCode);
  const autoName = d.materialCode
    ? `${contract?.number ?? ""} · ${d.materialCode} ${d.materialName} · ${d.producerName || "—"}`
    : "—";

  const save = () => {
    if (!d.materialCode) return pushToast("error", "Pick a material first.");
    const id = item?.id ?? `inv_new_${nextInventoryId}`;
    const next: InventoryItem = {
      ...d,
      id,
      inventoryId: item?.inventoryId ?? String(nextInventoryId),
      contractId,
      contractNumber: contract?.number ?? "",
    };
    upsertInventoryItem(next);
    onSaved(id);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative flex h-full w-[680px] max-w-[96vw] flex-col bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <h2 className="flex-1 text-lg font-semibold text-ink">{item ? "Edit Inventory" : "Add Inventory"}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-faint hover:bg-canvas">
            <XIcon className="text-xl" />
          </button>
        </div>

        <div className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm">
            <span className="text-ink-faint">Inventory name </span>
            <span className="font-medium text-ink">{autoName}</span>
          </div>

          <Labeled label="Material (code or name)">
            <IntelligentSearch
              items={MATERIALS}
              columns={[
                { header: "Code", get: (m) => m.code, mono: true },
                { header: "Name", get: (m) => m.name, grow: true },
                { header: "UOM", get: (m) => m.unit },
                { header: "MOA", get: (m) => m.moa },
              ]}
              getKey={(m) => m.code}
              getSearchText={(m) => `${m.code} ${m.name} ${m.unit} ${m.moa}`}
              onSelect={(m) => patch({ materialCode: m.code, materialName: m.name, materialUnit: m.unit })}
              value={d.materialCode ? `${d.materialCode} — ${d.materialName}` : ""}
              placeholder="Type a material code or name…"
            />
          </Labeled>

          {material && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-line px-3 py-2 text-sm">
              <span><span className="text-ink-faint">Material UOM:</span> {material.unit}</span>
              <span><span className="text-ink-faint">MOA:</span> {material.moa}</span>
              <span><span className="text-ink-faint">Acceptable EOI:</span> <span className="font-mono">{material.acceptableEoi.join(" · ")}</span></span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Labeled label="Producer">
              <IntelligentSearch
                items={PRODUCERS}
                columns={[
                  { header: "Number", get: (v) => v.number, mono: true },
                  { header: "Name", get: (v) => v.name, grow: true },
                  { header: "City", get: (v) => `${v.city}, ${v.state}` },
                ]}
                getKey={(v) => v.number}
                getSearchText={(v) => `${v.number} ${v.name} ${v.city}`}
                onSelect={(v) => patch({ producerNumber: v.number, producerName: v.name })}
                value={d.producerNumber ? `${d.producerNumber} — ${d.producerName}` : ""}
                placeholder="Producer…"
              />
            </Labeled>
            <Labeled label="Supplier">
              <IntelligentSearch
                items={SUPPLIERS}
                columns={[
                  { header: "Number", get: (v) => v.number, mono: true },
                  { header: "Name", get: (v) => v.name, grow: true },
                  { header: "City", get: (v) => `${v.city}, ${v.state}` },
                ]}
                getKey={(v) => v.number}
                getSearchText={(v) => `${v.number} ${v.name} ${v.city}`}
                onSelect={(v) => patch({ supplierNumber: v.number, supplierName: v.name })}
                value={d.supplierNumber ? `${d.supplierNumber} — ${d.supplierName}` : ""}
                placeholder="Supplier…"
              />
            </Labeled>
            <Labeled label="Location Type">
              <select
                value={d.locationType ?? "Jobsite"}
                onChange={(e) => patch({ locationType: e.target.value })}
                className="h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent"
              >
                {LOCATION_TYPES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Labeled>
            <Labeled label="Contract (read-only)">
              <input value={contract?.number ?? ""} disabled className="h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm opacity-60" />
            </Labeled>
            <Labeled label="Effective Date">
              <input type="date" value={d.effectiveDate ?? ""} onChange={(e) => patch({ effectiveDate: e.target.value || null })} className="h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" />
            </Labeled>
            <Labeled label="Expiration Date">
              <input type="date" value={d.expirationDate ?? ""} onChange={(e) => patch({ expirationDate: e.target.value || null })} className="h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" />
            </Labeled>
          </div>

          <Labeled label="Linked Pay Items">
            <div className="space-y-2">
              {d.payItemNumbers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {d.payItemNumbers.map((n) => (
                    <span key={n} className="flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                      <span className="font-mono">{n}</span>
                      <button onClick={() => patch({ payItemNumbers: d.payItemNumbers.filter((x) => x !== n) })} className="text-accent/70 hover:text-accent">×</button>
                    </span>
                  ))}
                </div>
              )}
              <IntelligentSearch
                items={payItems.filter((p) => !d.payItemNumbers.includes(p.number))}
                columns={[
                  { header: "Number", get: (p) => p.number, mono: true },
                  { header: "Description", get: (p) => p.description, grow: true },
                ]}
                getKey={(p) => p.number}
                getSearchText={(p) => `${p.number} ${p.description}`}
                onSelect={(p) => patch({ payItemNumbers: [...d.payItemNumbers, p.number] })}
                placeholder="Add a pay item…"
              />
            </div>
          </Labeled>

          <Labeled label="Notes">
            <textarea value={d.note} onChange={(e) => patch({ note: e.target.value })} rows={2} className="w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent" />
          </Labeled>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-canvas">Cancel</button>
          <button onClick={save} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover">
            {item ? "Save Inventory" : "Create Inventory"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="mb-1 block text-xs font-medium text-ink-soft">{label}</label>
      {children}
    </div>
  );
}

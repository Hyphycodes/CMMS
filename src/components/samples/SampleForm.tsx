/**
 * "Log In Samples" — the legacy horizontal entry row rebuilt as a grouped form
 * with IntelligentSearch lookups (brief 03). On save it generates the Sample
 * Identifier + Test ID, sets status "Logged In", and upserts optimistically.
 */
import { useMemo, useState } from "react";
import { useStore } from "@/store/store";
import { MATERIALS, PRODUCERS, SUPPLIERS, INSPECTION_TYPES, SAMPLED_FROM, RESPONSIBLE_LABS, STAFF_NAMES } from "@/data/reference";
import type { Sample } from "@/domain/types";
import { IntelligentSearch } from "@/components/ui/IntelligentSearch";
import { XIcon } from "@/components/ui/icons";

const today = () => new Date().toISOString().slice(0, 10);

export function SampleForm({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const currentUser = useStore((s) => s.currentUser);
  const visibleContracts = useStore((s) => s.visibleContracts());
  const payItemsByContract = useStore((s) => s.payItemsByContract);
  const items = useStore((s) => s.items);
  const samplesList = useStore((s) => s.samplesList);
  const upsertSample = useStore((s) => s.upsertSample);
  const pushToast = useStore((s) => s.pushToast);

  const nextSeq = useMemo(() => {
    let max = 100000;
    for (const s of samplesList) {
      const n = Number(s.sampleIdentifier.replace(/\D/g, ""));
      if (!Number.isNaN(n) && n > max) max = n;
    }
    return max + 1;
  }, [samplesList]);

  const isInspector = currentUser?.roles.includes("Inspector");
  const [d, setD] = useState<Sample>(() => ({
    id: "",
    sampleIdentifier: "",
    testId: "",
    inspectionType: "ACC",
    inspector: isInspector ? (currentUser?.name ?? "") : "",
    sampleDate: today(),
    totalSamples: 1,
    materialCode: "",
    materialName: "",
    desc1: "",
    desc2: "",
    desc3: "",
    specialId: "",
    inspectedQty: 0,
    materialUnit: "",
    producerNumber: "",
    producerName: "",
    supplierNumber: "",
    supplierName: "",
    sampledFrom: "Jobsite",
    latitude: "",
    longitude: "",
    specYear: "2022",
    dsaBaba: false,
    responsibleLab: "District Lab",
    contractId: null,
    payItemNumber: null,
    inventoryItemId: null,
    receivedDate: null,
    startedDate: null,
    completedDate: null,
    status: "Logged In",
    approverName: "",
    approvedDate: null,
    note: "",
    hasDocument: false,
  }));

  const patch = (p: Partial<Sample>) => setD((cur) => ({ ...cur, ...p }));

  const contractPayItems = d.contractId ? (payItemsByContract.get(d.contractId) ?? []) : [];
  const contractItems = d.contractId ? items.filter((i) => i.contractId === d.contractId) : [];

  const save = () => {
    if (!d.materialCode) return pushToast("error", "Pick a material before logging the sample.");
    if (!d.inspector) return pushToast("error", "An inspector is required.");
    const id = `smp_new_${nextSeq}`;
    const sample: Sample = {
      ...d,
      id,
      sampleIdentifier: `SMP-${nextSeq}`,
      testId: String(50000 + (nextSeq - 100000)),
    };
    upsertSample(sample);
    onSaved(id);
  };

  return (
    <div className="fixed inset-0 z-30 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative flex h-full w-[820px] max-w-[96vw] flex-col bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <h2 className="flex-1 text-lg font-semibold text-ink">Log In Samples</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-faint hover:bg-canvas">
            <XIcon className="text-xl" />
          </button>
        </div>

        <div className="scroll-thin min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          <Group title="Identification">
            <Labeled label="Inspection Type">
              <Select value={d.inspectionType} options={INSPECTION_TYPES} onChange={(v) => patch({ inspectionType: v })} />
            </Labeled>
            <Labeled label="Inspector">
              <IntelligentSearch
                items={STAFF_NAMES as readonly string[] as string[]}
                columns={[{ header: "Name", get: (n) => n, grow: true }]}
                getKey={(n) => n}
                getSearchText={(n) => n}
                onSelect={(n) => patch({ inspector: n })}
                value={d.inspector}
                placeholder="Inspector…"
              />
            </Labeled>
            <Labeled label="Sample Date">
              <Input type="date" value={d.sampleDate} onChange={(v) => patch({ sampleDate: v })} />
            </Labeled>
            <Labeled label="Total Samples">
              <Input type="number" value={String(d.totalSamples)} onChange={(v) => patch({ totalSamples: Number(v) || 0 })} />
            </Labeled>
          </Group>

          <Group title="Material">
            <Labeled label="Material" wide>
              <IntelligentSearch
                items={MATERIALS}
                columns={[
                  { header: "Code", get: (m) => m.code, mono: true },
                  { header: "Name", get: (m) => m.name, grow: true },
                  { header: "UOM", get: (m) => m.unit },
                ]}
                getKey={(m) => m.code}
                getSearchText={(m) => `${m.code} ${m.name} ${m.unit}`}
                onSelect={(m) => patch({ materialCode: m.code, materialName: m.name, materialUnit: m.unit })}
                value={d.materialCode ? `${d.materialCode} — ${d.materialName}` : ""}
                placeholder="Type a code or name…"
              />
            </Labeled>
            <Labeled label="Description 1"><Input value={d.desc1} onChange={(v) => patch({ desc1: v })} /></Labeled>
            <Labeled label="Description 2"><Input value={d.desc2} onChange={(v) => patch({ desc2: v })} /></Labeled>
            <Labeled label="Description 3"><Input value={d.desc3} onChange={(v) => patch({ desc3: v })} /></Labeled>
            <Labeled label="Special ID"><Input value={d.specialId} onChange={(v) => patch({ specialId: v })} /></Labeled>
            <Labeled label="Inspected Quantity">
              <Input type="number" value={String(d.inspectedQty)} onChange={(v) => patch({ inspectedQty: Number(v) || 0 })} />
            </Labeled>
            <Labeled label="Material Unit"><Input value={d.materialUnit} onChange={(v) => patch({ materialUnit: v })} disabled /></Labeled>
          </Group>

          <Group title="Source">
            <Labeled label="Producer" wide>
              <IntelligentSearch
                items={PRODUCERS}
                columns={[
                  { header: "Number", get: (v) => v.number, mono: true },
                  { header: "Name", get: (v) => v.name, grow: true },
                  { header: "City", get: (v) => `${v.city}, ${v.state}` },
                ]}
                getKey={(v) => v.number}
                getSearchText={(v) => `${v.number} ${v.name} ${v.city} ${v.state}`}
                onSelect={(v) => patch({ producerNumber: v.number, producerName: v.name })}
                value={d.producerNumber ? `${d.producerNumber} — ${d.producerName}` : ""}
                placeholder="Producer number or name…"
              />
            </Labeled>
            <Labeled label="Supplier" wide>
              <IntelligentSearch
                items={SUPPLIERS}
                columns={[
                  { header: "Number", get: (v) => v.number, mono: true },
                  { header: "Name", get: (v) => v.name, grow: true },
                  { header: "City", get: (v) => `${v.city}, ${v.state}` },
                ]}
                getKey={(v) => v.number}
                getSearchText={(v) => `${v.number} ${v.name} ${v.city} ${v.state}`}
                onSelect={(v) => patch({ supplierNumber: v.number, supplierName: v.name })}
                value={d.supplierNumber ? `${d.supplierNumber} — ${d.supplierName}` : ""}
                placeholder="Supplier number or name…"
              />
            </Labeled>
            <Labeled label="Sampled From">
              <Select value={d.sampledFrom} options={SAMPLED_FROM} onChange={(v) => patch({ sampledFrom: v })} />
            </Labeled>
            <Labeled label="Latitude"><Input value={d.latitude} onChange={(v) => patch({ latitude: v })} /></Labeled>
            <Labeled label="Longitude"><Input value={d.longitude} onChange={(v) => patch({ longitude: v })} /></Labeled>
          </Group>

          <Group title="Spec">
            <Labeled label="Spec & Year"><Input value={d.specYear} onChange={(v) => patch({ specYear: v })} /></Labeled>
            <Labeled label="DSA/BABA">
              <label className="flex h-9 items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-accent" checked={d.dsaBaba} onChange={(e) => patch({ dsaBaba: e.target.checked })} />
                Applies
              </label>
            </Labeled>
            <Labeled label="Responsible Lab">
              <Select value={d.responsibleLab} options={RESPONSIBLE_LABS} onChange={(v) => patch({ responsibleLab: v })} />
            </Labeled>
          </Group>

          <Group title="Linkage">
            <Labeled label="Contract" wide>
              <IntelligentSearch
                items={visibleContracts}
                columns={[
                  { header: "Number", get: (c) => c.number, mono: true },
                  { header: "Name", get: (c) => c.name, grow: true },
                ]}
                getKey={(c) => c.id}
                getSearchText={(c) => `${c.number} ${c.name} ${c.county}`}
                onSelect={(c) => patch({ contractId: c.id, payItemNumber: null, inventoryItemId: null })}
                value={d.contractId ? (visibleContracts.find((c) => c.id === d.contractId)?.number ?? "") : ""}
                placeholder="Assign to a contract (optional)…"
                allowClear
                onClear={() => patch({ contractId: null, payItemNumber: null, inventoryItemId: null })}
              />
            </Labeled>
            <Labeled label="Pay Item">
              <IntelligentSearch
                items={contractPayItems}
                columns={[
                  { header: "Number", get: (p) => p.number, mono: true },
                  { header: "Description", get: (p) => p.description, grow: true },
                ]}
                getKey={(p) => p.number}
                getSearchText={(p) => `${p.number} ${p.description}`}
                onSelect={(p) => patch({ payItemNumber: p.number })}
                value={d.payItemNumber ?? ""}
                placeholder={d.contractId ? "Pay item…" : "Pick a contract first"}
                disabled={!d.contractId}
              />
            </Labeled>
            <Labeled label="Inventory (link tested sample)">
              <IntelligentSearch
                items={contractItems}
                columns={[
                  { header: "Inv ID", get: (i) => i.inventoryId, mono: true },
                  { header: "Material", get: (i) => `${i.materialCode} ${i.materialName}`, grow: true },
                ]}
                getKey={(i) => i.id}
                getSearchText={(i) => `${i.inventoryId} ${i.materialCode} ${i.materialName}`}
                onSelect={(i) => patch({ inventoryItemId: i.id })}
                value={d.inventoryItemId ? (contractItems.find((i) => i.id === d.inventoryItemId)?.inventoryId ?? "") : ""}
                placeholder={d.contractId ? "Inventory (optional)…" : "Pick a contract first"}
                disabled={!d.contractId}
              />
            </Labeled>
          </Group>

          <Group title="Notes & Docs">
            <Labeled label="Notes" wide>
              <textarea
                value={d.note}
                onChange={(e) => patch({ note: e.target.value })}
                rows={2}
                className="w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </Labeled>
            <Labeled label="Lab paperwork on file">
              <label className="flex h-9 items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-accent" checked={d.hasDocument} onChange={(e) => patch({ hasDocument: e.target.checked })} />
                Document attached
              </label>
            </Labeled>
          </Group>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-canvas">
            Cancel
          </button>
          <button
            onClick={save}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover"
          >
            Log In Samples
          </button>
        </div>
      </div>
    </div>
  );
}

// --- small form primitives -------------------------------------------------

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{title}</h3>
      <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Labeled({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={["min-w-0", wide ? "sm:col-span-2" : ""].join(" ")}>
      <label className="mb-1 block text-xs font-medium text-ink-soft">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent disabled:opacity-60";

function Input({
  value,
  onChange,
  type = "text",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return <input type={type} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
}

function Select<O extends string>({ value, options, onChange }: { value: string; options: readonly O[]; onChange: (v: O) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as O)} className={inputCls}>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

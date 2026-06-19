/**
 * M2 — QMP (Quality Management Program) package for HMA / PCC (manual Ch. 10).
 * Assembles the required test series + docs for a sample into a reviewable
 * package with a status. Reuses the test records already in the Sample drawer;
 * only shown for HMA / Concrete materials.
 */
import { useMemo } from "react";
import { useStore } from "@/store/store";
import type { Sample, Test, QmpPackage as QmpPackageType, QmpStatus, MaterialFamily } from "@/domain/types";
import { QMP_STATUSES } from "@/domain/types";
import { Pill } from "@/components/ui/Pill";
import { FileDrop } from "@/components/ui/FileDrop";
import type { PillTone } from "@/domain/status";

const REQUIRED_SERIES: Partial<Record<MaterialFamily, string[]>> = {
  HMA: ["Gradation", "Asphalt Content", "Density", "Air Voids"],
  Concrete: ["Slump", "Air Content", "Compressive Strength", "Temperature"],
};

const STATUS_TONE: Record<QmpStatus, PillTone> = {
  Draft: "slate",
  Assembled: "blue",
  Submitted: "indigo",
  Accepted: "green",
  Rejected: "red",
};

function seriesSatisfied(label: string, tests: Test[]): boolean {
  const needle = label.toLowerCase();
  return tests.some(
    (t) =>
      t.testType.toLowerCase().includes(needle) ||
      t.fields.some((f) => f.label.toLowerCase().includes(needle) && f.value.trim() !== ""),
  );
}

export function QmpPackagePanel({ sample, tests, family }: { sample: Sample; tests: Test[]; family: MaterialFamily }) {
  const packages = useStore((s) => s.qmpPackagesList);
  const upsert = useStore((s) => s.upsertQmpPackage);
  const canEdit = useStore((s) => s.can("enter_tests"));

  const required = REQUIRED_SERIES[family] ?? [];
  const existing = useMemo(() => packages.find((p) => p.sampleId === sample.id), [packages, sample.id]);
  const checklist = required.map((label) => ({ label, satisfied: seriesSatisfied(label, tests) }));
  const allSatisfied = checklist.every((c) => c.satisfied);

  const assemble = () => {
    const pkg: QmpPackageType = {
      id: existing?.id ?? `qmp_${sample.id}`,
      contractId: sample.contractId,
      sampleId: sample.id,
      materialCode: sample.materialCode,
      materialName: sample.materialName,
      family,
      status: "Assembled",
      testIds: tests.map((t) => t.id),
      requiredSeries: checklist,
      note: existing?.note ?? "",
    };
    upsert(pkg);
  };
  const setStatus = (status: QmpStatus) => {
    if (!existing) return;
    upsert({ ...existing, status, testIds: tests.map((t) => t.id), requiredSeries: checklist });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between border-b border-line pb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">QMP Package ({family})</span>
        {existing && <Pill tone={STATUS_TONE[existing.status]}>{existing.status}</Pill>}
      </div>

      <ul className="mb-3 space-y-1">
        {checklist.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-sm">
            <span className={c.satisfied ? "text-green-600" : "text-ink-faint"}>{c.satisfied ? "✓" : "○"}</span>
            <span className={c.satisfied ? "text-ink" : "text-ink-soft"}>{c.label}</span>
          </li>
        ))}
        {checklist.length === 0 && <li className="text-sm text-ink-faint">No required series defined for {family}.</li>}
      </ul>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {canEdit && (
          <button onClick={assemble} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover">
            {existing ? "Re-assemble package" : "Assemble QMP package"}
          </button>
        )}
        {!allSatisfied && <span className="text-xs text-amber-700">Some required series are not yet satisfied.</span>}
        {existing && canEdit && (
          <select
            value={existing.status}
            onChange={(e) => setStatus(e.target.value as QmpStatus)}
            className="rounded-lg border border-line bg-surface px-2 py-1 text-sm outline-none"
          >
            {QMP_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {existing && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Package Documents</div>
          <FileDrop scope={{ entity: "qmp", entityId: existing.id }} disabled={!canEdit} label="Attach QMP document" />
        </div>
      )}
    </div>
  );
}

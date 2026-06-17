/**
 * Sample detail — one clean, scrollable page.
 * Flat section layout (no card boxes per group). Document upload at the bottom.
 * Approve / Reject are right-click only on the samples list, never here.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/store/store";
import { MATERIALS } from "@/data/reference";
import { SAMPLE_STATUSES, type Sample, type Test } from "@/domain/types";
import { Pill } from "@/components/ui/Pill";
import { EditableRowTable, EditText, type EditableColumn } from "@/components/ui/EditableRowTable";
import { CheckIcon, XIcon, FileIcon, PlusIcon } from "@/components/ui/icons";
import { sampleTone } from "@/domain/status";

const TESTING_STATUSES = SAMPLE_STATUSES.filter((s) => s !== "Approved" && s !== "Rejected");

interface Attachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  addedAt: string;
  url: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(val: string | null | undefined) {
  if (!val) return "";
  const d = new Date(val + "T00:00:00");
  return isNaN(d.getTime()) ? val : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Main drawer
// ---------------------------------------------------------------------------

export function SampleDetailDrawer({ sampleId, onClose }: { sampleId: string; onClose: () => void }) {
  const sample = useStore((s) => s.samplesList.find((x) => x.id === sampleId));
  const testsList = useStore((s) => s.testsList);
  const contractsById = useStore((s) => s.contractsById);

  const tests = useMemo(
    () => testsList.filter((t) => t.sampleId === sampleId).sort((a, b) => a.series - b.series),
    [testsList, sampleId],
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: Attachment[] = Array.from(files).map((f) => ({
      id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      size: f.size,
      mimeType: f.type,
      addedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      url: URL.createObjectURL(f),
    }));
    setAttachments((prev) => [...prev, ...next]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att) URL.revokeObjectURL(att.url);
      return prev.filter((a) => a.id !== id);
    });
  };

  if (!sample) return null;

  const contract = sample.contractId ? contractsById.get(sample.contractId) : null;

  return (
    <div className="fixed inset-0 z-30 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div
        className="relative flex h-full flex-col bg-surface shadow-2xl outline-none"
        style={{ width: 860, maxWidth: "94vw" }}
      >
        {/* header */}
        <div className="flex items-start gap-3 border-b border-line px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-ink">{sample.sampleIdentifier}</span>
              <span className="text-xs text-ink-faint">Test ID {sample.testId}</span>
              <Pill tone={sampleTone(sample.status)}>{sample.status}</Pill>
            </div>
            <h2 className="mt-1 truncate text-lg font-semibold text-ink">
              <span className="font-mono">{sample.materialCode}</span>
              <span className="mx-1.5 text-ink-faint">—</span>
              {sample.materialName}
            </h2>
            <p className="text-xs text-ink-soft">
              {sample.inspector} · {sample.producerName}
            </p>
          </div>
          <button onClick={() => printLabel(sample)} className="shrink-0 text-xs font-medium text-accent hover:underline">
            Create Sample Label
          </button>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-faint hover:bg-canvas">
            <XIcon className="text-xl" />
          </button>
        </div>

        {/* one scrollable page */}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-3xl space-y-8">

            {/* Identification */}
            <Section title="Identification">
              <StatusField sample={sample} />
              <F label="Inspection Type" value={sample.inspectionType} />
              <F label="Inspector" value={sample.inspector} />
              <F label="Sample Date" value={fmtDate(sample.sampleDate)} />
              <F label="Total Samples" value={sample.totalSamples} />
            </Section>

            {/* Material */}
            <Section title="Material">
              <F label="Material Code" value={sample.materialCode} mono />
              <F label="Material Name" value={sample.materialName} />
              <F label="Description 1" value={sample.desc1} />
              <F label="Description 2" value={sample.desc2} />
              <F label="Description 3" value={sample.desc3} />
              <F label="Special ID" value={sample.specialId} />
              <F label="Inspected Quantity" value={`${sample.inspectedQty} ${sample.materialUnit}`} />
            </Section>

            {/* Source */}
            <Section title="Source">
              <F label="Producer" value={`${sample.producerNumber} — ${sample.producerName}`} />
              <F label="Supplier" value={`${sample.supplierNumber} — ${sample.supplierName}`} />
              <F label="Sampled From" value={sample.sampledFrom} />
              <F label="Spec & Year" value={sample.specYear} />
              <F label="DSA / BABA" value={sample.dsaBaba ? "Yes" : "No"} />
              <F label="Responsible Lab" value={sample.responsibleLab} />
            </Section>

            {/* Linkage */}
            <Section title="Linkage">
              <F label="Contract" value={contract?.number ?? ""} />
              <F label="Pay Item" value={sample.payItemNumber ?? ""} mono />
              <F label="Inventory" value={sample.inventoryItemId ? "Linked" : ""} />
            </Section>

            {/* Dates */}
            <Section title="Dates">
              <F label="Received" value={fmtDate(sample.receivedDate)} />
              <F label="Testing Started" value={fmtDate(sample.startedDate)} />
              <F label="Completed" value={fmtDate(sample.completedDate)} />
            </Section>

            {/* Review */}
            <Section title="Review">
              <F label="Approver" value={sample.approverName} />
              <F label="Approved Date" value={fmtDate(sample.approvedDate)} />
              <F label="Note" value={sample.note} span />
            </Section>

            {/* Tests */}
            <TestsSection sample={sample} tests={tests} />

            {/* Documents */}
            <DocumentsSection
              attachments={attachments}
              fileInputRef={fileInputRef}
              onAdd={addFiles}
              onRemove={removeAttachment}
            />

          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flat section layout helpers
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-4 border-b border-line pb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">{title}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

function F({
  label,
  value,
  mono,
  span,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
  span?: boolean;
}) {
  const display =
    value !== null && value !== undefined && String(value).trim() !== ""
      ? String(value)
      : "—";
  return (
    <div className={span ? "col-span-full" : ""}>
      <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className={["text-sm text-ink", mono ? "font-mono" : ""].filter(Boolean).join(" ")}>{display}</div>
    </div>
  );
}

function StatusField({ sample }: { sample: Sample }) {
  const canTest = useStore((s) => s.can("enter_tests"));
  const setSampleStatus = useStore((s) => s.setSampleStatus);
  const decided = sample.status === "Approved" || sample.status === "Rejected";

  return (
    <div>
      <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Status</div>
      {canTest && !decided ? (
        <select
          value={sample.status}
          onChange={(e) => setSampleStatus(sample.id, e.target.value as Sample["status"])}
          className="rounded-md border border-line bg-surface px-2 py-1 text-sm font-medium outline-none focus:border-accent"
        >
          {TESTING_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      ) : (
        <div className="text-sm text-ink">{sample.status}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests section
// ---------------------------------------------------------------------------

function TestsSection({ sample, tests }: { sample: Sample; tests: Test[] }) {
  const canTest = useStore((s) => s.can("enter_tests"));
  const canValidate = useStore((s) => s.can("validate_test"));
  const currentUser = useStore((s) => s.currentUser);
  const templates = useStore((s) => s.testTemplates);
  const upsertTest = useStore((s) => s.upsertTest);
  const validateTest = useStore((s) => s.validateTest);

  const family = MATERIALS.find((m) => m.code === sample.materialCode)?.family ?? "Other";
  const template = templates.find((t) => t.materialFamily === family) ?? templates[0];
  const fieldDefs = tests[0]?.fields.map((f) => ({ key: f.key, label: f.label })) ?? template?.fields ?? [];

  const addTest = () => {
    if (!template) return;
    const nextSeries = tests.length ? Math.max(...tests.map((t) => t.series)) + 1 : 1;
    const test: Test = {
      id: `tst_new_${sample.id}_${nextSeries}_${Date.now()}`,
      sampleId: sample.id,
      series: nextSeries,
      testType: template.testType,
      testedBy: currentUser?.name ?? "",
      testDate: new Date().toISOString().slice(0, 10),
      fields: template.fields.map((f) => ({ key: f.key, label: f.label, value: "", spec: "", pass: undefined })),
      validated: false,
      validatedBy: "",
      validatedAt: null,
    };
    upsertTest(test);
  };

  const setField = (test: Test, key: string, value: string) => {
    upsertTest({ ...test, fields: test.fields.map((f) => (f.key === key ? { ...f, value } : f)) });
  };

  const columns: EditableColumn<Test>[] = [
    { key: "series", header: "Series", width: "70px", render: (t) => <span className="font-semibold tabular-nums">#{t.series}</span> },
    { key: "testType", header: "Test Type", width: "minmax(0,1.4fr)", render: (t) => <span className="text-ink">{t.testType}</span> },
    {
      key: "testedBy",
      header: "Tested By",
      width: "minmax(0,1fr)",
      render: (t) => <EditText value={t.testedBy} disabled={!canTest} onCommit={(v) => upsertTest({ ...t, testedBy: v })} />,
    },
    {
      key: "testDate",
      header: "Test Date",
      width: "130px",
      render: (t) => <EditText value={t.testDate ?? ""} disabled={!canTest} onCommit={(v) => upsertTest({ ...t, testDate: v })} />,
    },
    ...fieldDefs.map(
      (fd): EditableColumn<Test> => ({
        key: fd.key,
        header: fd.label,
        width: "minmax(0,1fr)",
        render: (t) => {
          const f = t.fields.find((x) => x.key === fd.key);
          return <EditText value={f?.value ?? ""} disabled={!canTest} onCommit={(v) => setField(t, fd.key, v)} />;
        },
      }),
    ),
    {
      key: "validated",
      header: "Validated",
      width: "120px",
      render: (t) =>
        t.validated ? (
          <span
            className="flex items-center gap-1 text-xs font-medium text-green-700"
            title={`${t.validatedBy} · ${t.validatedAt ?? ""}`}
          >
            <CheckIcon className="text-sm" /> {t.validatedBy || "Validated"}
          </span>
        ) : (
          <button
            onClick={() => validateTest(t.id, true)}
            disabled={!canValidate}
            title={canValidate ? "Validate this test" : "Your role can't validate tests"}
            className="rounded-md border border-line px-2 py-1 text-xs font-medium text-ink-soft transition hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
          >
            Validate
          </button>
        ),
    },
  ];

  return (
    <div>
      <div className="mb-4 border-b border-line pb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">Tests</span>
      </div>
      <div className="space-y-4">
        <EditableRowTable
          rows={tests}
          columns={columns}
          getRowId={(t) => t.id}
          onEdit={() => {}}
          onAdd={canTest ? addTest : undefined}
          addLabel="+ Add Test"
          readOnly={!canTest}
          emptyMessage="No tests recorded yet."
        />
        <p className="text-xs text-ink-faint">
          Each series is a separate test run on the same sample. Validate is a separate, role-gated step.
        </p>

        {tests.length > 1 && fieldDefs.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Compare series</h3>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-canvas text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    <th className="px-3 py-2">Field</th>
                    {tests.map((t) => (
                      <th key={t.id} className="px-3 py-2 text-right">
                        Series #{t.series}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fieldDefs.map((fd) => (
                    <tr key={fd.key} className="border-t border-line/70">
                      <td className="px-3 py-1.5 text-ink-soft">{fd.label}</td>
                      {tests.map((t) => (
                        <td key={t.id} className="px-3 py-1.5 text-right tabular-nums text-ink">
                          {t.fields.find((x) => x.key === fd.key)?.value || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documents section
// ---------------------------------------------------------------------------

function DocumentsSection({
  attachments,
  fileInputRef,
  onAdd,
  onRemove,
}: {
  attachments: Attachment[];
  fileInputRef: React.RefObject<HTMLInputElement>;
  onAdd: (files: FileList | null) => void;
  onRemove: (id: string) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onAdd(e.dataTransfer.files);
  };

  return (
    <div className="pb-8">
      <div className="mb-4 border-b border-line pb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">Documents</span>
      </div>

      {attachments.length > 0 && (
        <div className="mb-4 space-y-2">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-3 rounded-lg border border-line bg-canvas px-3 py-2.5">
              <FileIcon className="shrink-0 text-xl text-ink-faint" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{att.name}</div>
                <div className="text-xs text-ink-faint">
                  {formatBytes(att.size)}
                  {att.mimeType ? ` · ${att.mimeType}` : ""}
                  {" · "}Added {att.addedAt}
                </div>
              </div>
              <a
                href={att.url}
                download={att.name}
                className="shrink-0 text-xs font-medium text-accent hover:underline"
              >
                Download
              </a>
              <button
                onClick={() => onRemove(att.id)}
                title="Remove"
                className="shrink-0 rounded p-0.5 text-ink-faint transition hover:text-red-600"
              >
                <XIcon className="text-base" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          onAdd(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition select-none",
          dragging
            ? "border-accent bg-accent/5"
            : "border-line hover:border-accent/60 hover:bg-canvas",
        ].join(" ")}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-canvas text-ink-faint">
          <PlusIcon className="text-xl" />
        </div>
        <p className="text-sm font-medium text-ink">Add file</p>
        <p className="text-xs text-ink-faint">
          Click to browse or drag and drop — any file type, any size
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Print label
// ---------------------------------------------------------------------------

function printLabel(sample: Sample) {
  const w = window.open("", "_blank", "width=420,height=320");
  if (!w) return;
  w.document.write(`<!doctype html><title>${sample.sampleIdentifier}</title>
    <body style="font-family:ui-sans-serif,system-ui;padding:24px">
      <div style="border:2px solid #111;border-radius:8px;padding:16px;max-width:340px">
        <div style="font:700 18px monospace">${sample.sampleIdentifier}</div>
        <div style="color:#475467;font-size:12px;margin-bottom:8px">Test ID ${sample.testId}</div>
        <div style="font-size:14px"><b>${sample.materialCode}</b> — ${sample.materialName}</div>
        <div style="font-size:12px;color:#475467">Producer ${sample.producerNumber} — ${sample.producerName}</div>
        <div style="font-size:12px;color:#475467">Inspector ${sample.inspector} · ${sample.sampleDate}</div>
        <div style="font-size:12px;color:#475467">Lab: ${sample.responsibleLab}</div>
      </div>
    </body>`);
  w.document.close();
  w.focus();
  w.print();
}

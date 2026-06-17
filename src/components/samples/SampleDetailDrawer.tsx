/**
 * Sample detail (briefs 03–04). Details / Tests / Documents tabs. Header carries
 * the testing status control (inspector/lab), Approve/Reject (documentation), and
 * Create Sample Label. The Tests tab adds template-driven test records with
 * multiple series, a side-by-side comparison, and a role-gated Validate action.
 */
import { useMemo, useState } from "react";
import { useStore } from "@/store/store";
import { MATERIALS } from "@/data/reference";
import { SAMPLE_STATUSES, type Sample, type Test } from "@/domain/types";
import { DetailDrawer } from "@/components/ui/DetailDrawer";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { Pill } from "@/components/ui/Pill";
import { EditableRowTable, EditText, type EditableColumn } from "@/components/ui/EditableRowTable";
import { CheckIcon } from "@/components/ui/icons";
import { sampleTone } from "@/domain/status";
import type { Field } from "@/lib/fields";

const TABS = ["Details", "Tests", "Documents"] as const;
type Tab = (typeof TABS)[number];

// statuses an inspector/lab moves through (Approved/Rejected go via the buttons)
const TESTING_STATUSES = SAMPLE_STATUSES.filter((s) => s !== "Approved" && s !== "Rejected");

export function SampleDetailDrawer({ sampleId, onClose }: { sampleId: string; onClose: () => void }) {
  const sample = useStore((s) => s.samplesList.find((x) => x.id === sampleId));
  const testsList = useStore((s) => s.testsList);
  const [tab, setTab] = useState<Tab>("Details");

  const tests = useMemo(
    () => testsList.filter((t) => t.sampleId === sampleId).sort((a, b) => a.series - b.series),
    [testsList, sampleId],
  );

  if (!sample) return null;

  const tabs = TABS.map((t) => ({ id: t, label: t, count: t === "Tests" ? tests.length : 0 }));

  return (
    <DetailDrawer<Tab>
      eyebrow={
        <>
          <span className="font-mono text-sm text-ink-faint">{sample.sampleIdentifier}</span>
          <span className="text-xs text-ink-faint">Test ID {sample.testId}</span>
          <Pill tone={sampleTone(sample.status)}>{sample.status}</Pill>
        </>
      }
      title={
        <>
          <span className="font-mono">{sample.materialCode}</span>
          <span className="mx-1.5 text-ink-faint">—</span>
          {sample.materialName}
        </>
      }
      subtitle={`${sample.inspector} · ${sample.producerName}`}
      actions={<SampleActions sample={sample} />}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      onClose={onClose}
      width={840}
    >
      {tab === "Details" && <DetailsTab sample={sample} />}
      {tab === "Tests" && <TestsTab sample={sample} tests={tests} />}
      {tab === "Documents" && <DocumentsTab sample={sample} />}
    </DetailDrawer>
  );
}

function SampleActions({ sample }: { sample: Sample }) {
  const canTest = useStore((s) => s.can("enter_tests"));
  const canApprove = useStore((s) => s.can("approve_sample"));
  const setSampleStatus = useStore((s) => s.setSampleStatus);
  const approveSample = useStore((s) => s.approveSample);
  const decided = sample.status === "Approved" || sample.status === "Rejected";

  return (
    <div className="flex flex-col items-end gap-1.5">
      {canTest && !decided && (
        <select
          value={sample.status}
          onChange={(e) => setSampleStatus(sample.id, e.target.value as Sample["status"])}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-medium outline-none focus:border-accent"
        >
          {TESTING_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      )}
      {canApprove && (
        <div className="flex gap-1.5">
          <button
            onClick={() => approveSample(sample.id, { approve: true })}
            className="rounded-lg border border-green-300 bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100"
          >
            Approve
          </button>
          <button
            onClick={() => {
              const note = window.prompt("Reason for rejection:") ?? "";
              if (note.trim()) approveSample(sample.id, { approve: false, note: note.trim() });
            }}
            className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            Reject
          </button>
        </div>
      )}
      <button onClick={() => printLabel(sample)} className="text-xs text-accent hover:underline">
        Create Sample Label
      </button>
    </div>
  );
}

function DetailsTab({ sample }: { sample: Sample }) {
  const contractsById = useStore((s) => s.contractsById);
  const id: Field[] = [
    { label: "Inspection Type", value: sample.inspectionType },
    { label: "Inspector", value: sample.inspector },
    { label: "Sample Date", value: sample.sampleDate, type: "date" },
    { label: "Total Samples", value: sample.totalSamples, type: "number" },
  ];
  const material: Field[] = [
    { label: "Material Code", value: sample.materialCode, type: "mono" },
    { label: "Material Name", value: sample.materialName },
    { label: "Description 1", value: sample.desc1 },
    { label: "Description 2", value: sample.desc2 },
    { label: "Description 3", value: sample.desc3 },
    { label: "Special ID", value: sample.specialId },
    { label: "Inspected Quantity", value: `${sample.inspectedQty} ${sample.materialUnit}` },
  ];
  const source: Field[] = [
    { label: "Producer", value: `${sample.producerNumber} — ${sample.producerName}` },
    { label: "Supplier", value: `${sample.supplierNumber} — ${sample.supplierName}` },
    { label: "Sampled From", value: sample.sampledFrom },
    { label: "Latitude", value: sample.latitude },
    { label: "Longitude", value: sample.longitude },
  ];
  const spec: Field[] = [
    { label: "Spec & Year", value: sample.specYear },
    { label: "DSA/BABA", value: sample.dsaBaba, type: "bool" },
    { label: "Responsible Lab", value: sample.responsibleLab },
  ];
  const linkage: Field[] = [
    { label: "Contract", value: sample.contractId ? (contractsById.get(sample.contractId)?.number ?? "—") : "" },
    { label: "Pay Item", value: sample.payItemNumber ?? "", type: "mono" },
    { label: "Inventory", value: sample.inventoryItemId ? "Linked" : "" },
  ];
  const dates: Field[] = [
    { label: "Received Date", value: sample.receivedDate, type: "date" },
    { label: "Started Date", value: sample.startedDate, type: "date" },
    { label: "Completed Date", value: sample.completedDate, type: "date" },
  ];
  const approval: Field[] = [
    { label: "Approver Name", value: sample.approverName },
    { label: "Approved Date", value: sample.approvedDate, type: "date" },
    { label: "Note", value: sample.note },
  ];

  return (
    <div className="space-y-3">
      <FieldGroup title="Identification" fields={id} showEmpty />
      <FieldGroup title="Material" fields={material} />
      <FieldGroup title="Source" fields={source} />
      <FieldGroup title="Spec" fields={spec} />
      <FieldGroup title="Linkage" fields={linkage} />
      <FieldGroup title="Dates" fields={dates} defaultOpen={false} />
      <FieldGroup title="Approval" fields={approval} defaultOpen={false} />
    </div>
  );
}

function TestsTab({ sample, tests }: { sample: Sample; tests: Test[] }) {
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
    { key: "testedBy", header: "Tested By", width: "minmax(0,1fr)",
      render: (t) => <EditText value={t.testedBy} disabled={!canTest} onCommit={(v) => upsertTest({ ...t, testedBy: v })} /> },
    { key: "testDate", header: "Test Date", width: "130px",
      render: (t) => <EditText value={t.testDate ?? ""} disabled={!canTest} onCommit={(v) => upsertTest({ ...t, testDate: v })} /> },
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
          <span className="flex items-center gap-1 text-xs font-medium text-green-700" title={`${t.validatedBy} · ${t.validatedAt ?? ""}`}>
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
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Test records</h3>
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
        <p className="mt-1 text-xs text-ink-faint">
          Add more than one series to the same sample. Validate is a separate, role-gated step.
        </p>
      </div>

      {tests.length > 1 && fieldDefs.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Compare series</h3>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-canvas text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  <th className="px-3 py-2">Field</th>
                  {tests.map((t) => (
                    <th key={t.id} className="px-3 py-2 text-right">Series #{t.series}</th>
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
  );
}

function DocumentsTab({ sample }: { sample: Sample }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">
        Lab paperwork and sample labels. Real upload/download arrives with Storage in brief 12.
      </p>
      <div className="rounded-lg border border-line p-4 text-sm">
        {sample.hasDocument ? (
          <span className="flex items-center gap-2 text-ink">📎 Lab document on file</span>
        ) : (
          <span className="text-ink-soft">No documents to display.</span>
        )}
      </div>
    </div>
  );
}

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

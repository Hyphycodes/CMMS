import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { useStore } from "@/store/store";
import type { Contract, ContractSummary, ProjectDocumentRow, SubcontractorRow, FinalReview, PerformancePeriodRow } from "@/domain/types";
import type { PillTone } from "@/domain/status";
import { Pill } from "@/components/ui/Pill";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { FileDrop } from "@/components/ui/FileDrop";
import { DataGrid } from "@/components/ui/DataGrid";
import { TabBar } from "@/components/ui/TabBar";
import { CloseoutScoreChip, CloseoutChecklist } from "@/components/CloseoutScore";
import { EditText, EditNumber, EditDate } from "@/components/ui/EditableRowTable";
import { IntelligentSearch } from "@/components/ui/IntelligentSearch";
import { CONTRACTORS, DESIGNER_FIRMS } from "@/data/reference";
import type { Field } from "@/lib/fields";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

type FieldType = "text" | "mono" | "date" | "money" | "number" | "percent" | "days" | "bool";
interface FieldDef {
  label: string;
  key: keyof ContractSummary;
  type: FieldType;
}
interface CardDef {
  title: string;
  defaultOpen: boolean;
  fields: FieldDef[];
}

const CARDS: CardDef[] = [
  {
    title: "Contract Info",
    defaultOpen: true,
    fields: [
      { label: "Contract Number", key: "section", type: "mono" },
      { label: "Job Description", key: "jobDescription", type: "text" },
      { label: "Route", key: "route", type: "text" },
      { label: "Section", key: "section", type: "text" },
      { label: "County", key: "county", type: "text" },
      { label: "District", key: "district", type: "number" },
      { label: "Project Number", key: "projectNumber", type: "mono" },
      { label: "Federal Project Number", key: "federalProjectNumber", type: "mono" },
      { label: "Contract Status", key: "contractStatus", type: "text" },
      { label: "Prime Contractor", key: "primeContractor", type: "text" },
      { label: "Prime Contractor ID", key: "primeContractorId", type: "mono" },
      { label: "Marked Route", key: "markedRoute", type: "text" },
      { label: "County No. 1", key: "countyNo1", type: "text" },
      { label: "County 2", key: "county2", type: "text" },
      { label: "County No. 2", key: "countyNo2", type: "text" },
      { label: "County 3", key: "county3", type: "text" },
      { label: "County No. 3", key: "countyNo3", type: "text" },
      { label: "PPS Number", key: "ppsNumber", type: "mono" },
      { label: "Bonding Company", key: "bondingCompany", type: "text" },
      { label: "Resident Engineer", key: "residentEngineer", type: "text" },
      { label: "Resident Phone", key: "residentPhone", type: "text" },
      { label: "Consultant or In-House", key: "consultantOrInHouse", type: "text" },
      { label: "Supervising Field Engineer", key: "supervisingFieldEngineer", type: "text" },
      { label: "District Construction Engineer", key: "districtConstructionEngineer", type: "text" },
      { label: "Designer Firm", key: "designerFirm", type: "text" },
      { label: "Project Implementation Engineer", key: "projectImplementationEngineer", type: "text" },
    ],
  },
  {
    title: "Dates / Key Info",
    defaultOpen: true,
    fields: [
      { label: "Letting Date", key: "lettingDate", type: "date" },
      { label: "Award Date", key: "awardDate", type: "date" },
      { label: "Executed Date", key: "executedDate", type: "date" },
      { label: "Notice to Proceed", key: "noticeToProceedDate", type: "date" },
      { label: "Work Begin Date", key: "workBeginDate", type: "date" },
      { label: "Contract Completion Date", key: "contractCompletionDate", type: "date" },
      { label: "Final Inspection Date", key: "finalInspectionDate", type: "date" },
      { label: "Contract Suspended Date", key: "contractSuspendedDate", type: "date" },
      { label: "Progress Schedule Received", key: "progressScheduleReceived", type: "date" },
      { label: "EHS Plan Received", key: "ehsPlanReceived", type: "date" },
      { label: "DBE Program Received", key: "dbeProgramReceived", type: "date" },
    ],
  },
  {
    title: "Values",
    defaultOpen: false,
    fields: [
      { label: "Engineer's Estimate", key: "engineersEstimate", type: "money" },
      { label: "Awarded Amount", key: "awardedAmount", type: "money" },
      { label: "Current Contract Amount", key: "currentContractAmount", type: "money" },
      { label: "Total Paid to Date", key: "totalPaidToDate", type: "money" },
      { label: "Adjustment Amount", key: "adjustmentAmount", type: "money" },
      { label: "DBE Goal", key: "dbeGoalPct", type: "percent" },
      { label: "DBE Committed", key: "dbeCommittedPct", type: "percent" },
    ],
  },
  {
    title: "Work Type",
    defaultOpen: false,
    fields: [
      { label: "Primary Work Type", key: "primaryWorkType", type: "text" },
      { label: "Terrain", key: "terrain", type: "text" },
      { label: "Funding", key: "funding", type: "text" },
      { label: "Specification Year", key: "specificationYear", type: "text" },
      { label: "Units", key: "units", type: "text" },
      { label: "HMA Adjustment", key: "hmaAdj", type: "bool" },
      { label: "Steel Adjustment", key: "steelAdj", type: "bool" },
      { label: "Fuel Adjustment", key: "fuelAdj", type: "bool" },
      { label: "Trainees", key: "trainees", type: "bool" },
    ],
  },
  {
    title: "Time Spec",
    defaultOpen: false,
    fields: [
      { label: "Time Type", key: "timeType", type: "text" },
      { label: "Original Contract Time", key: "originalContractTime", type: "days" },
      { label: "Current Contract Time", key: "currentContractTime", type: "days" },
      { label: "Time Charged to Date", key: "timeChargedToDate", type: "days" },
      { label: "Contract Working Days", key: "contractWorkingDays", type: "number" },
      { label: "Working Days Used", key: "workingDaysUsed", type: "number" },
      { label: "Contract Calendar Days", key: "contractCalendarDays", type: "number" },
      { label: "Working Days Added", key: "workingDaysAdded", type: "number" },
      { label: "Calendar Days Added", key: "calendarDaysAdded", type: "number" },
      { label: "Liquidated Damages / Day", key: "liquidatedDamagesPerDay", type: "money" },
    ],
  },
];

const STATUS_TONE: Record<string, PillTone> = {
  Active: "green",
  Suspended: "amber",
  Completed: "blue",
  Closed: "slate",
};

export function ContractSummaryPage() {
  const { contractId } = useParams();
  const contract = useStore((s) => (contractId ? s.contract(contractId) : undefined));
  const canAccess = useStore((s) => (contractId ? s.canAccessContract(contractId) : false));

  const pctComplete = useMemo(() => {
    if (!contract) return 0;
    const { totalPaidToDate, currentContractAmount } = contract.summary;
    return currentContractAmount ? Math.round((totalPaidToDate / currentContractAmount) * 100) : 0;
  }, [contract]);

  if (!contract) {
    return <div className="grid h-full place-items-center text-ink-soft">Select a contract to begin.</div>;
  }
  if (!canAccess) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-sm text-ink-soft">
        You don't have access to contract {contract.number}. It isn't in your assigned scope.
      </div>
    );
  }
  const s = contract.summary;

  // One flat, scrollable page — every contract section is stacked and fully
  // visible (no tabs, no accordions). See build brief constraint #1.
  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-6">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-xl font-bold text-ink">{contract.number}</span>
                <Pill tone={STATUS_TONE[s.contractStatus] ?? "slate"}>{s.contractStatus}</Pill>
                <CloseoutScoreChip contract={contract} />
              </div>
              <h1 className="mt-0.5 text-lg text-ink">{contract.name}</h1>
              <p className="text-sm text-ink-soft">{s.jobDescription}</p>
              {contract.externalPlanLink && (
                <a
                  href={contract.externalPlanLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                >
                  📐 View plans (IDOT eplan)
                </a>
              )}
            </div>
            <Link
              to={`/contract/${contract.id}/inventory`}
              className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover"
            >
              Open Inventory
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KeyStat label="Current Amount" value={formatMoney(s.currentContractAmount)} />
            <KeyStat label="Paid to Date" value={formatMoney(s.totalPaidToDate)} sub={`${pctComplete}% of contract`} />
            <KeyStat label="Completion Date" value={formatDate(s.contractCompletionDate)} />
            <KeyStat label="Prime Contractor" value={s.primeContractor} />
          </div>
        </div>

        <ContractTabs contract={contract} />
      </div>
    </div>
  );
}

/** Legacy is tabbed — Summary · Insurance · Project Documents · Subcontracting ·
 *  Final Review. No collapsables anywhere; every field renders always (brief 23). */
const CONTRACT_TABS = ["Summary", "Insurance", "Project Documents", "Subcontracting", "Final Review"] as const;
type ContractTab = (typeof CONTRACT_TABS)[number];

function ContractTabs({ contract }: { contract: Contract }) {
  const [tab, setTab] = useState<ContractTab>("Summary");
  const tabs = CONTRACT_TABS.map((t) => ({
    id: t,
    label: t,
    count: t === "Project Documents" ? contract.projectDocuments.length : t === "Subcontracting" ? contract.subcontractors.length : undefined,
  }));
  return (
    <div>
      <TabBar<ContractTab> tabs={tabs} active={tab} onChange={setTab} />
      <div className="pt-4">
        {tab === "Summary" && <SummaryTab contract={contract} />}
        {tab === "Insurance" && <InsuranceTab contract={contract} />}
        {tab === "Project Documents" && <DocumentsTab contract={contract} />}
        {tab === "Subcontracting" && <SubcontractingTab contract={contract} />}
        {tab === "Final Review" && <FinalReviewTab contract={contract} />}
      </div>
    </div>
  );
}

// --- Summary (unchanged) ---------------------------------------------------

function SummaryTab({ contract }: { contract: Contract }) {
  const setContractSummary = useStore((s) => s.setContractSummary);
  const canEdit = useStore((s) => s.can("author_contract"));
  const authCount = useStore((s) => s.authorizationsForContract(contract.id).length);
  const summary = contract.summary;
  const patch = (p: Partial<ContractSummary>) => setContractSummary(contract.id, p);

  // Derived value math (computed, never stored) — brief 19.
  const netChange =
    summary.additions !== undefined || summary.deductions !== undefined
      ? (summary.additions ?? 0) - (summary.deductions ?? 0)
      : summary.adjustmentAmount;
  const adjusted = summary.awardedAmount + netChange;
  const changePct = summary.awardedAmount ? (netChange / summary.awardedAmount) * 100 : 0;
  const balanceRemaining = adjusted - summary.totalPaidToDate;

  return (
    <>
      {/* Editable working submittals (legacy editable; calendar pickers) — brief 19 */}
      <section className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
          Working Submittals {canEdit ? <span className="ml-1 text-[11px] font-normal text-ink-faint">(editable)</span> : null}
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <ELabel label="Progress Schedule Received"><EditDate value={summary.progressScheduleReceived ?? ""} disabled={!canEdit} onCommit={(v) => patch({ progressScheduleReceived: v || null })} /></ELabel>
          <ELabel label="Progress Schedule Approved"><EditDate value={summary.progressScheduleApproved ?? ""} disabled={!canEdit} onCommit={(v) => patch({ progressScheduleApproved: v || null })} /></ELabel>
          <ELabel label="Preconstruction Minutes"><EditDate value={summary.preconstructionMinutesDate ?? ""} disabled={!canEdit} onCommit={(v) => patch({ preconstructionMinutesDate: v || null })} /></ELabel>
          <ELabel label="EHS Plan Received"><EditDate value={summary.ehsPlanReceived ?? ""} disabled={!canEdit} onCommit={(v) => patch({ ehsPlanReceived: v || null })} /></ELabel>
          <ELabel label="DBE Program Received"><EditDate value={summary.dbeProgramReceived ?? ""} disabled={!canEdit} onCommit={(v) => patch({ dbeProgramReceived: v || null })} /></ELabel>
          <ELabel label="Notice of Intent Processed"><EditDate value={summary.noticeOfIntentProcessed ?? ""} disabled={!canEdit} onCommit={(v) => patch({ noticeOfIntentProcessed: v || null })} /></ELabel>
          <label className="flex items-center gap-2 self-end pb-1 text-sm text-ink">
            <input type="checkbox" className="h-4 w-4 accent-accent disabled:opacity-50" checked={!!summary.noticeOfIntentRequired} disabled={!canEdit} onChange={(e) => patch({ noticeOfIntentRequired: e.target.checked })} />
            Notice of Intent Required
          </label>
        </div>
      </section>

      {/* Derived contract values — computed, not stored (brief 19). */}
      <section className="mt-3 overflow-hidden rounded-card border border-line bg-surface">
        <div className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">Contract Values</div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 px-4 py-4 sm:grid-cols-3 lg:grid-cols-4">
          <ValueStat label="Awarded Value" value={formatMoney(summary.awardedAmount)} />
          <ValueStat label="Additions" value={formatMoney(summary.additions ?? 0)} />
          <ValueStat label="Deductions" value={formatMoney(summary.deductions ?? 0)} />
          <ValueStat label="Net Change" value={formatMoney(netChange)} />
          <ValueStat label="Adjusted Contract Value" value={formatMoney(adjusted)} />
          <ValueStat label="Change %" value={`${changePct.toFixed(2)}%`} />
          <ValueStat label="Authorization Count" value={String(authCount)} />
          <ValueStat label="Completed Amount" value={formatMoney(summary.totalPaidToDate)} />
          <ValueStat label="Balance Remaining" value={formatMoney(balanceRemaining)} />
        </div>
      </section>

      <div className="mt-3 space-y-3">
        {CARDS.map((card) => (
          <SummaryCard key={card.title} card={card} summary={summary} />
        ))}
      </div>
    </>
  );
}

function ValueStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="truncate text-sm font-semibold tabular-nums text-ink" title={value}>{value}</div>
    </div>
  );
}

/** Flat, always-visible summary group (no collapse, every field shown — brief 23). */
function SummaryCard({ card, summary }: { card: CardDef; summary: ContractSummary }) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="border-b border-line px-4 py-2.5">
        <span className="text-sm font-semibold text-ink">{card.title}</span>
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
        {card.fields.map((f) => (
          <div key={f.label} className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{f.label}</div>
            <div className={["truncate text-sm text-ink", f.type === "mono" ? "font-mono" : ""].join(" ")} title={String(summary[f.key] ?? "")}>
              {formatSummary(summary[f.key], f.type)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// --- Insurance -------------------------------------------------------------

function InsuranceTab({ contract }: { contract: Contract }) {
  const ins = contract.insurance;
  const s = contract.summary;
  const block: Field[] = [
    { label: "Contractor No", value: ins.contractorNo, type: "mono" },
    { label: "Prime Contractor Name", value: ins.primeContractorName },
    { label: "Letting Date", value: s.lettingDate, type: "date" },
    { label: "Item No", value: ins.itemNo },
    { label: "Final Acceptance Date", value: ins.finalAcceptanceDate, type: "date" },
    { label: "Award Date", value: s.awardDate, type: "date" },
    { label: "% Complete", value: ins.pctComplete, type: "percent" },
    { label: "% Complete Date", value: ins.pctCompleteDate, type: "date" },
  ];
  const rrColumns: ColumnDef<Contract["insurance"]["railroad"][number]>[] = [
    { id: "policyNo", accessorKey: "policyNo", header: "Policy No", size: 140 },
    { id: "company", accessorKey: "company", header: "Company", size: 200, meta: { grow: true } },
    { id: "expiration", accessorKey: "expiration", header: "Expiration", size: 130, cell: ({ getValue }) => formatDate((getValue() as string) ?? null) },
    { id: "approvalRequested", accessorKey: "approvalRequested", header: "Approval Requested", size: 160, cell: ({ getValue }) => formatDate((getValue() as string) ?? null) },
    { id: "approvalReceipt", accessorKey: "approvalReceipt", header: "Approval Receipt", size: 150, cell: ({ getValue }) => formatDate((getValue() as string) ?? null) },
    { id: "workCompleted", accessorKey: "workCompleted", header: "Work Completed", size: 150, cell: ({ getValue }) => formatDate((getValue() as string) ?? null) },
  ];

  return (
    <div className="space-y-4">
      <FieldGroup title="Contractor Insurance" fields={block} showEmpty collapsible={false} />
      <section className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Policy Status</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-canvas text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              <th className="px-4 py-2">Policy</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Expiration</th>
            </tr>
          </thead>
          <tbody>
            {ins.policies.map((p) => (
              <tr key={p.kind} className="border-t border-line/70">
                <td className="px-4 py-2 text-ink">{p.kind}</td>
                <td className="px-4 py-2 text-ink-soft">{p.status}</td>
                <td className="px-4 py-2 text-ink-soft">{formatDate(p.expiration)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Railroad Insurance</h3>
        <div className="h-[260px]">
          <DataGrid data={ins.railroad} columns={rrColumns} getRowId={(r) => r.policyNo} emptyMessage="No records to display." />
        </div>
      </div>
    </div>
  );
}

// --- Project Documents -----------------------------------------------------

function DocumentsTab({ contract }: { contract: Contract }) {
  const addProjectDocument = useStore((s) => s.addProjectDocument);
  const canAuthor = useStore((s) => s.can("author_contract"));
  const columns: ColumnDef<ProjectDocumentRow>[] = [
    { id: "date", accessorKey: "date", header: "Date", size: 120, cell: ({ getValue }) => formatDate(getValue() as string) },
    { id: "title", accessorKey: "title", header: "Title", size: 260, meta: { grow: true } },
    { id: "subject", accessorKey: "subject", header: "Subject", size: 140 },
    { id: "from", accessorKey: "from", header: "From", size: 130 },
    { id: "attachment", accessorKey: "attachment", header: "Attachment", size: 220,
      cell: ({ row }) => (row.original.hasFile ? <span className="text-accent">📎 {row.original.attachment}</span> : <span className="text-ink-faint">—</span>) },
    { id: "origin", accessorKey: "origin", header: "Origin", size: 110 },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Project Documents — the contract file repository</h3>
        {canAuthor && (
          <button
            onClick={() =>
              addProjectDocument(contract.id, {
                id: `doc_new_${Date.now()}`,
                date: new Date().toISOString().slice(0, 10),
                title: "New Document",
                subject: "Correspondence",
                from: "",
                attachment: "pending-upload.pdf",
                origin: "IDOT",
                hasFile: false,
              })
            }
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover"
          >
            + Add Document Record
          </button>
        )}
      </div>
      <FileDrop scope={{ entity: "contractDoc", entityId: contract.id }} disabled={!canAuthor} label="Upload a project document" />
      <div className="h-[440px]">
        <DataGrid
          data={contract.projectDocuments}
          columns={columns}
          getRowId={(r) => r.id}
          toolbar
          searchable
          searchPlaceholder="Filter documents…"
          countLabel="documents"
          globalSearchText={(r) => `${r.title} ${r.subject} ${r.from} ${r.origin}`}
          emptyMessage="No records to display."
        />
      </div>
    </div>
  );
}

// --- Subcontracting --------------------------------------------------------

function SubcontractingTab({ contract }: { contract: Contract }) {
  const addSubcontractor = useStore((s) => s.addSubcontractor);
  const canAuthor = useStore((s) => s.can("author_contract"));
  const companies = useMemo(() => [...CONTRACTORS, ...DESIGNER_FIRMS].map((name, i) => ({ name, number: `C-${10000 + i}` })), []);
  const columns: ColumnDef<SubcontractorRow>[] = [
    { id: "createDate", accessorKey: "createDate", header: "Create Date", size: 140, cell: ({ getValue }) => formatDate(getValue() as string) },
    { id: "companyNumber", accessorKey: "companyNumber", header: "Company Number", size: 160 },
    { id: "name", accessorKey: "name", header: "Subcontractor Name", size: 320, meta: { grow: true } },
  ];
  return (
    <div className="space-y-3">
      {canAuthor && (
        <div className="max-w-md">
          <label className="mb-1 block text-xs font-medium text-ink-soft">Add Subcontractor</label>
          <IntelligentSearch
            items={companies}
            columns={[
              { header: "Number", get: (c) => c.number, mono: true },
              { header: "Company", get: (c) => c.name, grow: true },
            ]}
            getKey={(c) => c.number}
            getSearchText={(c) => `${c.number} ${c.name}`}
            onSelect={(c) =>
              addSubcontractor(contract.id, {
                createDate: new Date().toISOString().slice(0, 10),
                companyNumber: c.number,
                name: c.name,
              })
            }
            placeholder="Search companies to add…"
          />
        </div>
      )}
      <div className="h-[420px]">
        <DataGrid data={contract.subcontractors} columns={columns} getRowId={(r) => `${r.companyNumber}:${r.createDate}`} emptyMessage="No records to display." />
      </div>
    </div>
  );
}

// --- Final Review ----------------------------------------------------------

function FinalReviewTab({ contract }: { contract: Contract }) {
  const setFinalReview = useStore((s) => s.setFinalReview);
  const canEdit = useStore((s) => s.can("author_contract"));
  const fr = contract.finalReview;
  const d = fr.finalFromDistrict;
  const dr = fr.documentationReview;
  const mr = fr.materialsReview;
  const dbe = fr.dbeCloseOut;

  const update = (next: FinalReview) => setFinalReview(contract.id, next);
  const patchD = (p: Partial<typeof d>) => update({ ...fr, finalFromDistrict: { ...d, ...p } });
  const patchDr = (p: Partial<typeof dr>) => update({ ...fr, documentationReview: { ...dr, ...p } });
  const patchMr = (p: Partial<typeof mr>) => update({ ...fr, materialsReview: { ...mr, ...p } });
  const patchDbe = (p: Partial<typeof dbe>) => update({ ...fr, dbeCloseOut: { ...dbe, ...p } });
  const patchPP = (rows: PerformancePeriodRow[]) => update({ ...fr, performancePeriod: rows });
  const editPP = (i: number, patch: Partial<PerformancePeriodRow>) => patchPP(fr.performancePeriod.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addPP = () =>
    patchPP([...fr.performancePeriod, { type: "", required: "", yearPlaced: "", inspectionNeeded: false, repairsNeeded: false, letterSent: null, repairsMade: false, bond: "", approvedLetterSent: null }]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-faint">Close-out tracker — the RE/inspector's working closeout form. Every field edits and persists.</p>

      <CloseoutChecklist contract={contract} />


      <ESection title="Final from District">
        <EDate label="Deadline for Final FRC Bills" value={d.deadlineForFinalFrcBills} disabled={!canEdit} onChange={(v) => patchD({ deadlineForFinalFrcBills: v })} />
        <EDate label="Final Inspection Letters" value={d.finalInspectionLetters} disabled={!canEdit} onChange={(v) => patchD({ finalInspectionLetters: v })} />
        <ECheckField label="All Pay Items are Final" checked={d.allPayItemsFinal} disabled={!canEdit} onChange={(v) => patchD({ allPayItemsFinal: v })} />
        <EDate label="FQ Sent" value={d.fqSent} disabled={!canEdit} onChange={(v) => patchD({ fqSent: v })} />
        <EDate label="Agree to FQ" value={d.fqAgree} disabled={!canEdit} onChange={(v) => patchD({ fqAgree: v })} />
        <EDate label="Certified FQ" value={d.fqCertified} disabled={!canEdit} onChange={(v) => patchD({ fqCertified: v })} />
        <EDate label="FQ Received" value={d.fqReceived} disabled={!canEdit} onChange={(v) => patchD({ fqReceived: v })} />
        <ECheckField label="Challenged FQ" checked={d.challengedFq} disabled={!canEdit} onChange={(v) => patchD({ challengedFq: v })} />
        <ECheckField label="Intent to File Claim" checked={d.intentToFileClaim} disabled={!canEdit} onChange={(v) => patchD({ intentToFileClaim: v })} />
        <EDate label="Claim Submitted L1" value={d.claimL1} disabled={!canEdit} onChange={(v) => patchD({ claimL1: v })} />
        <EDate label="Claim Submitted L2" value={d.claimL2} disabled={!canEdit} onChange={(v) => patchD({ claimL2: v })} />
        <EDate label="Claim Resolved" value={d.claimResolved} disabled={!canEdit} onChange={(v) => patchD({ claimResolved: v })} />
        <EDate label="Qty Adjustment Letter" value={d.qtyAdjustmentLetter} disabled={!canEdit} onChange={(v) => patchD({ qtyAdjustmentLetter: v })} />
        <EDate label="OPs Signoff" value={d.opsSignoff} disabled={!canEdit} onChange={(v) => patchD({ opsSignoff: v })} />
        <EDate label="Final Inspection BC-71" value={d.finalInspectionBc71} disabled={!canEdit} onChange={(v) => patchD({ finalInspectionBc71: v })} />
        <EDate label="Checklist FPE BC-111" value={d.fpeBc111} disabled={!canEdit} onChange={(v) => patchD({ fpeBc111: v })} />
        <EDate label="Local Agency Cert BC-608" value={d.localAgencyCertBc608} disabled={!canEdit} onChange={(v) => patchD({ localAgencyCertBc608: v })} />
        <EDate label="Records/Payroll Retention" value={d.recordsPayrollRetention} disabled={!canEdit} onChange={(v) => patchD({ recordsPayrollRetention: v })} />
        <ETextField label="Records Location" value={d.recordsLocation} disabled={!canEdit} onChange={(v) => patchD({ recordsLocation: v })} />
        <EDate label="State Completion Notice" value={d.stateCompletionNotice} disabled={!canEdit} onChange={(v) => patchD({ stateCompletionNotice: v })} />
        <ECheckField label="For CO to Review" checked={d.forCoToReview} disabled={!canEdit} onChange={(v) => patchD({ forCoToReview: v })} />
        <ETextField label="Project Control Manager" value={d.projectControlManager} disabled={!canEdit} onChange={(v) => patchD({ projectControlManager: v })} />
      </ESection>

      <ESection title="Documentation Review">
        <EDate label="Records Turned In" value={dr.recordsTurnedIn} disabled={!canEdit} onChange={(v) => patchDr({ recordsTurnedIn: v })} />
        <EDate label="Audit Start" value={dr.auditStart} disabled={!canEdit} onChange={(v) => patchDr({ auditStart: v })} />
        <ENumberField label="Number of Issues" value={dr.numIssues} disabled={!canEdit} onChange={(v) => patchDr({ numIssues: v })} />
        <EDate label="Audit Given to Resident" value={dr.auditGivenToResident} disabled={!canEdit} onChange={(v) => patchDr({ auditGivenToResident: v })} />
        <EDate label="Corrections Due" value={dr.correctionsDue} disabled={!canEdit} onChange={(v) => patchDr({ correctionsDue: v })} />
        <EDate label="Corrections Submitted" value={dr.correctionsSubmitted} disabled={!canEdit} onChange={(v) => patchDr({ correctionsSubmitted: v })} />
        <EDate label="Audit Finalized" value={dr.auditFinalized} disabled={!canEdit} onChange={(v) => patchDr({ auditFinalized: v })} />
        <ETextField label="Reviewer" value={dr.reviewer} disabled={!canEdit} onChange={(v) => patchDr({ reviewer: v })} />
        <ETextField label="Progress Review" value={dr.progressReview} disabled={!canEdit} onChange={(v) => patchDr({ progressReview: v })} />
        <ETextField label="Remarks [N]" value={dr.remarks} disabled={!canEdit} onChange={(v) => patchDr({ remarks: v })} />
      </ESection>

      <ESection title="Materials Review">
        <ENumberField label="Number of Issues" value={mr.numIssues} disabled={!canEdit} onChange={(v) => patchMr({ numIssues: v })} />
        <ENumberField label="Exceptions" value={mr.exceptions} disabled={!canEdit} onChange={(v) => patchMr({ exceptions: v })} />
        <EDate label="Review Start" value={mr.reviewStart} disabled={!canEdit} onChange={(v) => patchMr({ reviewStart: v })} />
        <EDate label="Audit Given" value={mr.auditGiven} disabled={!canEdit} onChange={(v) => patchMr({ auditGiven: v })} />
        <EDate label="Corrections Due" value={mr.correctionsDue} disabled={!canEdit} onChange={(v) => patchMr({ correctionsDue: v })} />
        <EDate label="PCC Signoff Sent" value={mr.pccSignoffSent} disabled={!canEdit} onChange={(v) => patchMr({ pccSignoffSent: v })} />
        <EDate label="PCC Signoff Rcvd" value={mr.pccSignoffRcvd} disabled={!canEdit} onChange={(v) => patchMr({ pccSignoffRcvd: v })} />
        <EDate label="HMA Signoff Sent" value={mr.hmaSignoffSent} disabled={!canEdit} onChange={(v) => patchMr({ hmaSignoffSent: v })} />
        <EDate label="HMA Signoff Rcvd" value={mr.hmaSignoffRcvd} disabled={!canEdit} onChange={(v) => patchMr({ hmaSignoffRcvd: v })} />
        <EDate label="Soils Signoff Sent" value={mr.soilsSignoffSent} disabled={!canEdit} onChange={(v) => patchMr({ soilsSignoffSent: v })} />
        <EDate label="Soils Signoff Rcvd" value={mr.soilsSignoffRcvd} disabled={!canEdit} onChange={(v) => patchMr({ soilsSignoffRcvd: v })} />
        <EDate label="Materials Cert Date" value={mr.materialsCertDate} disabled={!canEdit} onChange={(v) => patchMr({ materialsCertDate: v })} />
        <EDate label="Exception Letter Date" value={mr.exceptionLetterDate} disabled={!canEdit} onChange={(v) => patchMr({ exceptionLetterDate: v })} />
        <ETextField label="Reviewer" value={mr.reviewer} disabled={!canEdit} onChange={(v) => patchMr({ reviewer: v })} />
        <ETextField label="Remarks [N]" value={mr.remarks} disabled={!canEdit} onChange={(v) => patchMr({ remarks: v })} />
      </ESection>

      <section className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-sm font-semibold text-ink">Performance Period Status</span>
          {canEdit && (
            <button onClick={addPP} className="text-xs font-medium text-accent hover:underline">+ Add performance period</button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-canvas text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                {["Type", "Required", "Year Placed", "Insp. Needed", "Repairs Needed", "Letter Sent", "Repairs Made", "Bond", "Approved Letter", ""].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fr.performancePeriod.map((r, i) => (
                <tr key={i} className="border-t border-line/70">
                  <td className="px-2 py-1.5"><EditText value={r.type} disabled={!canEdit} onCommit={(v) => editPP(i, { type: v })} /></td>
                  <td className="px-2 py-1.5"><EditText value={r.required} disabled={!canEdit} onCommit={(v) => editPP(i, { required: v })} /></td>
                  <td className="px-2 py-1.5"><EditText value={r.yearPlaced} disabled={!canEdit} onCommit={(v) => editPP(i, { yearPlaced: v })} /></td>
                  <td className="px-2 py-1.5 text-center"><EBool checked={r.inspectionNeeded} disabled={!canEdit} onChange={(v) => editPP(i, { inspectionNeeded: v })} /></td>
                  <td className="px-2 py-1.5 text-center"><EBool checked={r.repairsNeeded} disabled={!canEdit} onChange={(v) => editPP(i, { repairsNeeded: v })} /></td>
                  <td className="px-2 py-1.5"><EditDate value={r.letterSent ?? ""} disabled={!canEdit} onCommit={(v) => editPP(i, { letterSent: v || null })} /></td>
                  <td className="px-2 py-1.5 text-center"><EBool checked={r.repairsMade} disabled={!canEdit} onChange={(v) => editPP(i, { repairsMade: v })} /></td>
                  <td className="px-2 py-1.5"><EditText value={r.bond} disabled={!canEdit} onCommit={(v) => editPP(i, { bond: v })} /></td>
                  <td className="px-2 py-1.5"><EditDate value={r.approvedLetterSent ?? ""} disabled={!canEdit} onCommit={(v) => editPP(i, { approvedLetterSent: v || null })} /></td>
                  <td className="px-2 py-1.5 text-right">
                    {canEdit && (
                      <button onClick={() => patchPP(fr.performancePeriod.filter((_, j) => j !== i))} className="text-xs text-ink-faint hover:text-red-600">✕</button>
                    )}
                  </td>
                </tr>
              ))}
              {fr.performancePeriod.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-3 text-center text-ink-faint">No performance periods.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ESection title="DBE Close Out">
        <ENumberField label="DBE Commitment %" value={dbe.commitmentPct} disabled={!canEdit} onChange={(v) => patchDbe({ commitmentPct: v })} />
        <ECheckField label="BC 2115 Received" checked={dbe.bc2115} disabled={!canEdit} onChange={(v) => patchDbe({ bc2115: v })} />
        <ECheckField label="All SBE 2115 Received" checked={dbe.allSbe2115} disabled={!canEdit} onChange={(v) => patchDbe({ allSbe2115: v })} />
        <ECheckField label="Approved" checked={dbe.approved} disabled={!canEdit} onChange={(v) => patchDbe({ approved: v })} />
        <ECheckField label="Goal Met" checked={dbe.goalMet} disabled={!canEdit} onChange={(v) => patchDbe({ goalMet: v })} />
        <ECheckField label="DBE Final Doc (SBE 2028)" checked={dbe.dbeFinalDocSbe2028} disabled={!canEdit} onChange={(v) => patchDbe({ dbeFinalDocSbe2028: v })} />
        <ECheckField label="Waiver Requested" checked={dbe.waiverRequested} disabled={!canEdit} onChange={(v) => patchDbe({ waiverRequested: v })} />
        <ECheckField label="2028 Packet Approved" checked={dbe.packet2028Approved} disabled={!canEdit} onChange={(v) => patchDbe({ packet2028Approved: v })} />
        <ECheckField label="Waiver Granted" checked={dbe.waiverGranted} disabled={!canEdit} onChange={(v) => patchDbe({ waiverGranted: v })} />
        <ETextField label="EEO Remarks [N]" value={dbe.eeoRemarks} disabled={!canEdit} onChange={(v) => patchDbe({ eeoRemarks: v })} />
        <ETextField label="EEO Representative" value={dbe.eeoRepresentative} disabled={!canEdit} onChange={(v) => patchDbe({ eeoRepresentative: v })} />
      </ESection>

      <section className="rounded-card border border-line bg-surface p-4">
        <div className="mb-2 text-sm font-semibold text-ink">Closeout Documents [D]</div>
        <FileDrop scope={{ entity: "finalReview", entityId: contract.id }} disabled={!canEdit} label="Attach a closeout document" />
      </section>
    </div>
  );
}

// --- editable Final Review field primitives (brief 18) ---------------------

function ESection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">{title}</div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 lg:grid-cols-3">{children}</div>
    </section>
  );
}
function ELabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      {children}
    </div>
  );
}
function EDate({ label, value, disabled, onChange }: { label: string; value: string | null; disabled?: boolean; onChange: (v: string | null) => void }) {
  return (
    <ELabel label={label}>
      <EditDate value={value ?? ""} disabled={disabled} onCommit={(v) => onChange(v || null)} />
    </ELabel>
  );
}
function ETextField({ label, value, disabled, onChange }: { label: string; value: string; disabled?: boolean; onChange: (v: string) => void }) {
  return (
    <ELabel label={label}>
      <EditText value={value} disabled={disabled} onCommit={onChange} />
    </ELabel>
  );
}
function ENumberField({ label, value, disabled, onChange }: { label: string; value: number; disabled?: boolean; onChange: (v: number) => void }) {
  return (
    <ELabel label={label}>
      <EditNumber value={value} disabled={disabled} onCommit={onChange} />
    </ELabel>
  );
}
function ECheckField({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 self-end pb-1 text-sm text-ink">
      <input type="checkbox" className="h-4 w-4 accent-accent disabled:opacity-50" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
function EBool({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return <input type="checkbox" className="h-4 w-4 accent-accent disabled:opacity-50" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />;
}

// --- shared bits -----------------------------------------------------------

function KeyStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-0.5 truncate text-base font-semibold text-ink" title={value}>{value}</div>
      {sub && <div className="text-xs text-ink-soft">{sub}</div>}
    </div>
  );
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

function formatSummary(v: unknown, type: FieldType): string {
  if (type === "bool") return v ? "Yes" : "No";
  if (isEmpty(v)) return "—";
  switch (type) {
    case "date":
      return formatDate(v as string);
    case "money":
      return formatMoney(v as number);
    case "percent":
      return `${v}%`;
    case "days":
      return `${formatNumber(v as number)} days`;
    case "number":
      return formatNumber(v as number);
    default:
      return String(v);
  }
}

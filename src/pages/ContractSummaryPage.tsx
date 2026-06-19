import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { useStore } from "@/store/store";
import type { Contract, ContractSummary, ProjectDocumentRow, SubcontractorRow } from "@/domain/types";
import type { PillTone } from "@/domain/status";
import { Pill } from "@/components/ui/Pill";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { FileDrop } from "@/components/ui/FileDrop";
import { DataGrid } from "@/components/ui/DataGrid";
import { IntelligentSearch } from "@/components/ui/IntelligentSearch";
import { CONTRACTORS, DESIGNER_FIRMS } from "@/data/reference";
import type { Field } from "@/lib/fields";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

type FieldType = "text" | "mono" | "date" | "money" | "number" | "percent" | "days";
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
      { label: "Resident Engineer", key: "residentEngineer", type: "text" },
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
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xl font-bold text-ink">{contract.number}</span>
                <Pill tone={STATUS_TONE[s.contractStatus] ?? "slate"}>{s.contractStatus}</Pill>
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

        <FlatSection title="Summary">
          <SummaryTab summary={s} />
        </FlatSection>
        <FlatSection title="Insurance">
          <InsuranceTab contract={contract} />
        </FlatSection>
        <FlatSection title="Project Documents" count={contract.projectDocuments.length}>
          <DocumentsTab contract={contract} />
        </FlatSection>
        <FlatSection title="Subcontracting" count={contract.subcontractors.length}>
          <SubcontractingTab contract={contract} />
        </FlatSection>
        <FlatSection title="Final Review">
          <FinalReviewTab contract={contract} />
        </FlatSection>
      </div>
    </div>
  );
}

/** A flat, always-visible section header + body (replaces the old tab pages). */
function FlatSection({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2 border-b border-line pb-2">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {count !== undefined && <span className="text-xs text-ink-faint tabular-nums">{count}</span>}
      </div>
      {children}
    </section>
  );
}

// --- Summary (unchanged) ---------------------------------------------------

function SummaryTab({ summary }: { summary: ContractSummary }) {
  const [showEmpty, setShowEmpty] = useState(false);
  return (
    <>
      <div className="flex items-center justify-end">
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" className="h-4 w-4 cursor-pointer accent-accent" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} />
          Show empty fields
        </label>
      </div>
      <div className="mt-3 space-y-3">
        {CARDS.map((card) => (
          <SummaryCard key={card.title} card={card} summary={summary} showEmpty={showEmpty} />
        ))}
      </div>
    </>
  );
}

/** Flat, always-visible summary group (no collapse). */
function SummaryCard({ card, summary, showEmpty }: { card: CardDef; summary: ContractSummary; showEmpty: boolean }) {
  const visibleFields = card.fields.filter((f) => showEmpty || !isEmpty(summary[f.key]));
  if (visibleFields.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="border-b border-line px-4 py-2.5">
        <span className="text-sm font-semibold text-ink">{card.title}</span>
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleFields.map((f) => (
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
  const [showEmpty, setShowEmpty] = useState(true);
  const fr = contract.finalReview;
  const d = fr.finalFromDistrict;
  const dr = fr.documentationReview;
  const mr = fr.materialsReview;
  const dbe = fr.dbeCloseOut;

  const finalFromDistrict: Field[] = [
    { label: "Deadline for Final FRC Bills", value: d.deadlineForFinalFrcBills, type: "date" },
    { label: "Final Inspection Letters", value: d.finalInspectionLetters, type: "date" },
    { label: "All Pay Items Final", value: d.allPayItemsFinal, type: "bool" },
    { label: "FQ Sent", value: d.fqSent, type: "date" },
    { label: "FQ Agree", value: d.fqAgree, type: "date" },
    { label: "FQ Certified", value: d.fqCertified, type: "date" },
    { label: "FQ Received", value: d.fqReceived, type: "date" },
    { label: "Challenged FQ", value: d.challengedFq, type: "bool" },
    { label: "Intent to File Claim", value: d.intentToFileClaim, type: "bool" },
    { label: "Claim L1", value: d.claimL1, type: "date" },
    { label: "Claim L2", value: d.claimL2, type: "date" },
    { label: "Claim Resolved", value: d.claimResolved, type: "date" },
    { label: "Qty Adjustment Letter", value: d.qtyAdjustmentLetter, type: "date" },
    { label: "OPs Signoff", value: d.opsSignoff, type: "date" },
    { label: "Final Inspection BC-71", value: d.finalInspectionBc71, type: "date" },
    { label: "FPE BC 111", value: d.fpeBc111, type: "date" },
    { label: "Local Agency Cert BC 608", value: d.localAgencyCertBc608, type: "date" },
    { label: "Records/Payroll Retention", value: d.recordsPayrollRetention, type: "date" },
    { label: "Records Location", value: d.recordsLocation },
    { label: "State Completion Notice", value: d.stateCompletionNotice, type: "date" },
    { label: "For CO to Review", value: d.forCoToReview, type: "bool" },
    { label: "Project Control Manager", value: d.projectControlManager },
  ];
  const documentationReview: Field[] = [
    { label: "Records Turned In", value: dr.recordsTurnedIn, type: "date" },
    { label: "Audit Start", value: dr.auditStart, type: "date" },
    { label: "# Issues", value: dr.numIssues, type: "number" },
    { label: "Audit Given to Resident", value: dr.auditGivenToResident, type: "date" },
    { label: "Corrections Due", value: dr.correctionsDue, type: "date" },
    { label: "Corrections Submitted", value: dr.correctionsSubmitted, type: "date" },
    { label: "Audit Finalized", value: dr.auditFinalized, type: "date" },
    { label: "Reviewer", value: dr.reviewer },
    { label: "Progress Review", value: dr.progressReview },
    { label: "Remarks", value: dr.remarks },
  ];
  const materialsReview: Field[] = [
    { label: "# Issues", value: mr.numIssues, type: "number" },
    { label: "Exceptions", value: mr.exceptions, type: "number" },
    { label: "Review Start", value: mr.reviewStart, type: "date" },
    { label: "Audit Given", value: mr.auditGiven, type: "date" },
    { label: "Corrections Due", value: mr.correctionsDue, type: "date" },
    { label: "PCC Signoff Sent", value: mr.pccSignoffSent, type: "date" },
    { label: "PCC Signoff Rcvd", value: mr.pccSignoffRcvd, type: "date" },
    { label: "HMA Signoff Sent", value: mr.hmaSignoffSent, type: "date" },
    { label: "HMA Signoff Rcvd", value: mr.hmaSignoffRcvd, type: "date" },
    { label: "Soils Signoff Sent", value: mr.soilsSignoffSent, type: "date" },
    { label: "Soils Signoff Rcvd", value: mr.soilsSignoffRcvd, type: "date" },
    { label: "Materials Cert Date", value: mr.materialsCertDate, type: "date" },
    { label: "Exception Letter Date", value: mr.exceptionLetterDate, type: "date" },
    { label: "Reviewer", value: mr.reviewer },
    { label: "Remarks", value: mr.remarks },
  ];
  const dbeCloseOut: Field[] = [
    { label: "Commitment %", value: dbe.commitmentPct, type: "percent" },
    { label: "BC 2115", value: dbe.bc2115, type: "bool" },
    { label: "All SBE 2115", value: dbe.allSbe2115, type: "bool" },
    { label: "Approved", value: dbe.approved, type: "bool" },
    { label: "Goal Met", value: dbe.goalMet, type: "bool" },
    { label: "DBE Final Doc SBE 2028", value: dbe.dbeFinalDocSbe2028, type: "bool" },
    { label: "Waiver Requested", value: dbe.waiverRequested, type: "bool" },
    { label: "Waiver Granted", value: dbe.waiverGranted, type: "bool" },
    { label: "2028 Packet Approved", value: dbe.packet2028Approved, type: "bool" },
    { label: "EEO Remarks", value: dbe.eeoRemarks },
    { label: "EEO Representative", value: dbe.eeoRepresentative },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-faint">Close-out dashboard</span>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" className="h-4 w-4 cursor-pointer accent-accent" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} />
          Show empty fields
        </label>
      </div>
      <FieldGroup title="Final from District" fields={finalFromDistrict} showEmpty={showEmpty} collapsible={false} />
      <FieldGroup title="Documentation Review" fields={documentationReview} showEmpty={showEmpty} collapsible={false} />
      <FieldGroup title="Materials Review" fields={materialsReview} showEmpty={showEmpty} collapsible={false} />
      <section className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Performance Period Status</div>
        {fr.performancePeriod.length === 0 ? (
          <p className="px-4 py-4 text-sm text-ink-faint">No records to display.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-canvas text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                {["Type", "Required", "Year Placed", "Inspection Needed", "Repairs Needed", "Letter Sent", "Repairs Made", "Bond", "Approved Letter Sent"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fr.performancePeriod.map((r, i) => (
                <tr key={i} className="border-t border-line/70">
                  <td className="px-3 py-2">{r.type}</td>
                  <td className="px-3 py-2">{r.required}</td>
                  <td className="px-3 py-2">{r.yearPlaced}</td>
                  <td className="px-3 py-2">{r.inspectionNeeded ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">{r.repairsNeeded ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">{formatDate(r.letterSent)}</td>
                  <td className="px-3 py-2">{r.repairsMade ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">{r.bond}</td>
                  <td className="px-3 py-2">{formatDate(r.approvedLetterSent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <FieldGroup title="DBE Close Out" fields={dbeCloseOut} showEmpty={showEmpty} collapsible={false} />
    </div>
  );
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

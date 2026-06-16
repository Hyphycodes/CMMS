import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "@/store/store";
import type { ContractSummary } from "@/domain/types";
import type { PillTone } from "@/domain/status";
import { Pill } from "@/components/ui/Pill";
import { ChevronDown } from "@/components/ui/icons";
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
      { label: "Contract Number", key: "section", type: "mono" }, // section incl. number context
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
  const [showEmpty, setShowEmpty] = useState(false);

  const pctComplete = useMemo(() => {
    if (!contract) return 0;
    const { totalPaidToDate, currentContractAmount } = contract.summary;
    return currentContractAmount ? Math.round((totalPaidToDate / currentContractAmount) * 100) : 0;
  }, [contract]);

  if (!contract) {
    return <div className="grid h-full place-items-center text-ink-soft">Select a contract to begin.</div>;
  }
  const s = contract.summary;

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-6">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xl font-bold text-ink">{contract.number}</span>
              <Pill tone={STATUS_TONE[s.contractStatus] ?? "slate"}>{s.contractStatus}</Pill>
            </div>
            <h1 className="mt-0.5 text-lg text-ink">{contract.name}</h1>
            <p className="text-sm text-ink-soft">{s.jobDescription}</p>
          </div>
          <Link
            to={`/contract/${contract.id}/inventory`}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover"
          >
            Open Inventory
          </Link>
        </div>

        {/* key fields strip — the handful that get watched */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KeyStat label="Current Amount" value={formatMoney(s.currentContractAmount)} />
          <KeyStat label="Paid to Date" value={formatMoney(s.totalPaidToDate)} sub={`${pctComplete}% of contract`} />
          <KeyStat label="Completion Date" value={formatDate(s.contractCompletionDate)} />
          <KeyStat label="Prime Contractor" value={s.primeContractor} />
        </div>

        {/* disclosure toggle */}
        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Contract Summary</h2>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer accent-accent"
              checked={showEmpty}
              onChange={(e) => setShowEmpty(e.target.checked)}
            />
            Show empty fields
          </label>
        </div>

        {/* cards */}
        <div className="mt-3 space-y-3">
          {CARDS.map((card) => (
            <Card key={card.title} card={card} summary={s} showEmpty={showEmpty} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({
  card,
  summary,
  showEmpty,
}: {
  card: CardDef;
  summary: ContractSummary;
  showEmpty: boolean;
}) {
  const [open, setOpen] = useState(card.defaultOpen);

  const visibleFields = card.fields.filter((f) => showEmpty || !isEmpty(summary[f.key]));
  const hiddenCount = card.fields.length - visibleFields.length;

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-canvas"
      >
        <ChevronDown className={["text-base text-ink-faint transition", open ? "" : "-rotate-90"].join(" ")} />
        <span className="text-sm font-semibold text-ink">{card.title}</span>
        <span className="text-xs text-ink-faint">{visibleFields.length} fields</span>
        {!showEmpty && hiddenCount > 0 && (
          <span className="ml-auto text-xs text-ink-faint">{hiddenCount} empty hidden</span>
        )}
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 border-t border-line px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleFields.map((f) => (
            <div key={f.label} className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{f.label}</div>
              <div
                className={["truncate text-sm text-ink", f.type === "mono" ? "font-mono" : ""].join(" ")}
                title={String(summary[f.key] ?? "")}
              >
                {formatField(summary[f.key], f.type)}
              </div>
            </div>
          ))}
          {visibleFields.length === 0 && (
            <p className="text-sm text-ink-faint">All fields in this section are empty.</p>
          )}
        </div>
      )}
    </section>
  );
}

function KeyStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-0.5 truncate text-base font-semibold text-ink" title={value}>
        {value}
      </div>
      {sub && <div className="text-xs text-ink-soft">{sub}</div>}
    </div>
  );
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

function formatField(v: unknown, type: FieldType): string {
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

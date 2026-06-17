import type { ColumnDef } from "@tanstack/react-table";
import type { Sample } from "@/domain/types";
import type { DataGridColumnMeta } from "@/components/ui/DataGrid";
import { Pill } from "@/components/ui/Pill";
import { sampleTone } from "@/domain/status";
import { formatDate, formatNumber } from "@/lib/format";

/** Sample row enriched with the joined contract number for display. */
export type SampleRow = Sample & { contractNumber: string };

const meta = (m: DataGridColumnMeta) => m;

/** Full Ch.9 sample column set — legacy field names verbatim. */
export const sampleColumns: ColumnDef<SampleRow>[] = [
  { id: "sampleIdentifier", accessorKey: "sampleIdentifier", header: "Sample Identifier", size: 150,
    cell: ({ getValue }) => <span className="font-mono text-[13px] font-semibold text-ink">{getValue() as string}</span> },
  { id: "testId", accessorKey: "testId", header: "Test ID", size: 90,
    cell: ({ getValue }) => <span className="font-mono text-[13px] text-ink-soft">{getValue() as string}</span> },
  { id: "inspectionType", accessorKey: "inspectionType", header: "Inspection Type", size: 120 },
  { id: "inspector", accessorKey: "inspector", header: "Inspector", size: 130 },
  { id: "sampleDate", accessorKey: "sampleDate", header: "Sample Date", size: 120,
    cell: ({ getValue }) => formatDate(getValue() as string) },
  { id: "totalSamples", accessorKey: "totalSamples", header: "Total", size: 70, meta: meta({ align: "right" }) },
  {
    id: "material",
    accessorFn: (r) => `${r.materialCode} ${r.materialName}`,
    header: "Material",
    size: 260,
    meta: meta({ grow: true }),
    cell: ({ row }) => (
      <div className="min-w-0">
        <span className="font-mono text-[13px] font-semibold text-ink">{row.original.materialCode}</span>
        <span className="mx-1.5 text-ink-faint">—</span>
        <span className="text-[13px] text-ink">{row.original.materialName}</span>
      </div>
    ),
  },
  { id: "desc1", accessorKey: "desc1", header: "Description 1", size: 120, cell: ({ getValue }) => (getValue() as string) || "—" },
  { id: "specialId", accessorKey: "specialId", header: "Special ID", size: 110, cell: ({ getValue }) => (getValue() as string) || "—" },
  { id: "inspectedQty", accessorFn: (r) => r.inspectedQty, header: "Inspected Qty", size: 120, meta: meta({ align: "right" }),
    cell: ({ row }) => `${formatNumber(row.original.inspectedQty, 1)} ${row.original.materialUnit}` },
  { id: "producer", accessorKey: "producerName", header: "Producer", size: 160,
    cell: ({ row }) => (
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] text-ink">{row.original.producerName}</div>
        <div className="font-mono text-[11px] text-ink-faint">{row.original.producerNumber}</div>
      </div>
    ) },
  { id: "supplier", accessorKey: "supplierName", header: "Supplier", size: 160,
    cell: ({ row }) => (
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] text-ink">{row.original.supplierName}</div>
        <div className="font-mono text-[11px] text-ink-faint">{row.original.supplierNumber}</div>
      </div>
    ) },
  { id: "sampledFrom", accessorKey: "sampledFrom", header: "Sampled From", size: 150 },
  { id: "specYear", accessorKey: "specYear", header: "Spec & Year", size: 100 },
  { id: "dsaBaba", accessorFn: (r) => (r.dsaBaba ? "Yes" : "No"), header: "DSA/BABA", size: 90 },
  { id: "responsibleLab", accessorKey: "responsibleLab", header: "Responsible Lab", size: 160 },
  { id: "contract", accessorKey: "contractNumber", header: "Contract", size: 100,
    cell: ({ getValue }) => <span className="font-mono text-[13px] text-ink-soft">{(getValue() as string) || "—"}</span> },
  { id: "payItem", accessorFn: (r) => r.payItemNumber ?? "", header: "Pay Item", size: 110,
    cell: ({ getValue }) => <span className="font-mono text-[12px] text-ink-soft">{(getValue() as string) || "—"}</span> },
  { id: "inventory", accessorFn: (r) => (r.inventoryItemId ? "Linked" : ""), header: "Inventory", size: 100,
    cell: ({ getValue }) => (getValue() as string) || "—" },
  { id: "status", accessorKey: "status", header: "Status", size: 120,
    cell: ({ row }) => <Pill tone={sampleTone(row.original.status)}>{row.original.status}</Pill> },
  { id: "receivedDate", accessorFn: (r) => r.receivedDate ?? "", header: "Received", size: 110, cell: ({ getValue }) => formatDate((getValue() as string) || null) },
  { id: "completedDate", accessorFn: (r) => r.completedDate ?? "", header: "Completed", size: 110, cell: ({ getValue }) => formatDate((getValue() as string) || null) },
  { id: "approverName", accessorKey: "approverName", header: "Approver", size: 130, cell: ({ getValue }) => (getValue() as string) || "—" },
  { id: "approvedDate", accessorFn: (r) => r.approvedDate ?? "", header: "Approved Date", size: 120, cell: ({ getValue }) => formatDate((getValue() as string) || null) },
  { id: "note", accessorKey: "note", header: "Notes", size: 180, cell: ({ getValue }) => <span className="truncate text-[12px] text-ink-soft" title={getValue() as string}>{(getValue() as string) || "—"}</span> },
  { id: "docs", accessorFn: (r) => (r.hasDocument ? "📎" : ""), header: "Docs", size: 70, meta: meta({ align: "center" }) },
];

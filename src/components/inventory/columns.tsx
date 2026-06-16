import type { ColumnDef } from "@tanstack/react-table";
import type { InventoryItem } from "@/domain/types";
import { Pill } from "@/components/ui/Pill";
import { inventoryTone } from "@/domain/status";

/**
 * Full Ch. 8 Contract Inventory Summary column set. Material code is always
 * paired with its plain-English name; status is a plain colored word.
 */
export const inventoryColumns: ColumnDef<InventoryItem>[] = [
  {
    id: "inventoryId",
    accessorKey: "inventoryId",
    header: "Inventory ID",
    size: 110,
    cell: ({ getValue }) => (
      <span className="font-mono text-[13px] text-ink-soft">{getValue() as string}</span>
    ),
  },
  {
    id: "material",
    accessorFn: (r) => `${r.materialCode} ${r.materialName}`,
    header: "Material",
    size: 300,
    cell: ({ row }) => (
      <div className="min-w-0">
        <span className="font-mono text-[13px] font-semibold text-ink">
          {row.original.materialCode}
        </span>
        <span className="mx-1.5 text-ink-faint">—</span>
        <span className="text-[13px] text-ink">{row.original.materialName}</span>
      </div>
    ),
  },
  {
    id: "producer",
    accessorFn: (r) => r.producerName,
    header: "Producer",
    size: 210,
    cell: ({ row }) => (
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] text-ink">{row.original.producerName}</div>
        <div className="font-mono text-[11px] text-ink-faint">{row.original.producerNumber}</div>
      </div>
    ),
  },
  {
    id: "supplier",
    accessorFn: (r) => r.supplierName,
    header: "Supplier",
    size: 210,
    cell: ({ row }) => (
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] text-ink">{row.original.supplierName}</div>
        <div className="font-mono text-[11px] text-ink-faint">{row.original.supplierNumber}</div>
      </div>
    ),
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Inventory Status",
    size: 170,
    cell: ({ row }) => <Pill tone={inventoryTone(row.original.status)}>{row.original.status}</Pill>,
  },
  {
    id: "payItems",
    accessorFn: (r) => r.payItemNumbers.join(", "),
    header: "Pay Items",
    size: 130,
    cell: ({ row }) => (
      <span className="font-mono text-[12px] text-ink-soft">
        {row.original.payItemNumbers.join(", ") || "—"}
      </span>
    ),
  },
  {
    id: "note",
    accessorKey: "note",
    header: "Note",
    size: 200,
    cell: ({ getValue }) => {
      const v = (getValue() as string) || "";
      return (
        <span className="truncate text-[12px] text-ink-soft" title={v}>
          {v || "—"}
        </span>
      );
    },
  },
];

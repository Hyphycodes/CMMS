/**
 * Thin wrapper over the shared DataGrid. Keeps the inventory-specific column set
 * + grid template; all grid behavior (sticky header, sort, multi-select with
 * shift-range, virtualization) now lives in DataGrid. Behavior unchanged.
 */
import type {
  SortingState,
  RowSelectionState,
  OnChangeFn,
} from "@tanstack/react-table";
import type { InventoryItem } from "@/domain/types";
import { DataGrid } from "@/components/ui/DataGrid";
import { inventoryColumns } from "./columns";

// Shared grid template keeps the (non-scrolling) header aligned with the
// virtualized body, and flexes so normal widths need no horizontal scroll.
const GRID_TEMPLATE =
  "44px 110px minmax(220px,2fr) minmax(168px,1.3fr) minmax(168px,1.3fr) 172px 120px minmax(140px,1.1fr)";

interface Props {
  data: InventoryItem[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  onOpen: (item: InventoryItem) => void;
  onContext: (e: React.MouseEvent, item: InventoryItem) => void;
}

export function InventoryGrid({
  data,
  sorting,
  onSortingChange,
  rowSelection,
  onRowSelectionChange,
  onOpen,
  onContext,
}: Props) {
  return (
    <DataGrid
      data={data}
      columns={inventoryColumns}
      getRowId={(r) => r.id}
      gridTemplate={GRID_TEMPLATE}
      minWidth={940}
      enableSelection
      rowSelection={rowSelection}
      onRowSelectionChange={onRowSelectionChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      onRowClick={onOpen}
      onRowContextMenu={onContext}
    />
  );
}

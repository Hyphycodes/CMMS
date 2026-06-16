import { NavLink, useParams } from "react-router-dom";
import { useMemo } from "react";
import { useStore } from "@/store/store";
import {
  InboxIcon,
  SummaryIcon,
  DiaryIcon,
  BookIcon,
  BoxesIcon,
  EstimateIcon,
  AuthIcon,
} from "@/components/ui/icons";

const TREE_NODES = [
  { key: "", label: "Contract", Icon: SummaryIcon, end: true },
  { key: "diary", label: "Diary", Icon: DiaryIcon, stub: true },
  { key: "quantity-book", label: "Quantity Book", Icon: BookIcon, stub: true },
  { key: "inventory", label: "Inventory", Icon: BoxesIcon },
  { key: "pay-estimate", label: "Pay Estimate", Icon: EstimateIcon, stub: true },
  { key: "authorizations", label: "Authorizations", Icon: AuthIcon, stub: true },
] as const;

export function Sidebar() {
  const { contractId } = useParams();
  const contract = useStore((s) => (contractId ? s.contract(contractId) : undefined));
  const contracts = useStore((s) => s.contracts);
  const totalReady = useMemo(
    () => contracts.reduce((n, c) => n + c.readyForReviewCount, 0),
    [contracts],
  );

  return (
    <aside className="row-span-1 flex flex-col gap-1 border-r border-line bg-surface px-3 py-3">
      <NavLink
        to="/inbox"
        className={({ isActive }) =>
          [
            "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
            isActive ? "bg-accent text-accent-fg" : "text-ink hover:bg-accent-soft",
          ].join(" ")
        }
      >
        {({ isActive }) => (
          <>
            <InboxIcon className="text-lg" />
            <span className="flex-1">My Work Tasks</span>
            <span
              className={[
                "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                isActive ? "bg-white/25 text-white" : "bg-blue-100 text-blue-700",
              ].join(" ")}
            >
              {totalReady.toLocaleString()}
            </span>
          </>
        )}
      </NavLink>

      <div className="mt-4 px-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        Contract
      </div>

      {contract ? (
        <div className="px-3 pb-1 pt-0.5">
          <div className="font-mono text-sm font-semibold text-ink">{contract.number}</div>
          <div className="truncate text-xs text-ink-soft" title={contract.name}>
            {contract.name}
          </div>
        </div>
      ) : (
        <p className="px-3 py-1 text-xs text-ink-faint">No contract selected.</p>
      )}

      <nav className="mt-1 flex flex-col gap-0.5">
        {TREE_NODES.map(({ key, label, Icon, ...rest }) => {
          const stub = "stub" in rest && rest.stub;
          const end = "end" in rest && rest.end;
          const to = contractId
            ? `/contract/${contractId}${key ? `/${key}` : ""}`
            : undefined;
          const ready =
            key === "inventory" && contract ? contract.readyForReviewCount : 0;
          if (!to) {
            return (
              <span
                key={label}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-faint"
              >
                <Icon className="text-lg" />
                {label}
              </span>
            );
          }
          return (
            <NavLink
              key={label}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                  isActive
                    ? "bg-accent-soft font-semibold text-accent"
                    : "text-ink-soft hover:bg-canvas hover:text-ink",
                ].join(" ")
              }
            >
              <Icon className="text-lg" />
              <span className="flex-1">{label}</span>
              {ready > 0 && (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-blue-700">
                  {ready}
                </span>
              )}
              {stub && (
                <span className="text-[10px] uppercase tracking-wide text-ink-faint opacity-0 transition group-hover:opacity-100">
                  soon
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto px-3 pt-4 text-[11px] text-ink-faint">
        {contracts.length} contracts loaded
      </div>
    </aside>
  );
}

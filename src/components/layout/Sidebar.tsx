import { NavLink, useParams } from "react-router-dom";
import { useStore } from "@/store/store";
import {
  HomeIcon,
  SummaryIcon,
  DiaryIcon,
  BookIcon,
  BoxesIcon,
  EstimateIcon,
  AuthIcon,
  FlaskIcon,
  TruckIcon,
  TagIcon,
  BeakerIcon,
  InboxIcon,
  UsersIcon,
  XIcon,
} from "@/components/ui/icons";

const TREE_NODES = [
  { key: "", label: "Contract", Icon: SummaryIcon, end: true },
  { key: "diary", label: "Diary", Icon: DiaryIcon },
  { key: "quantity-book", label: "Quantity Book", Icon: BookIcon },
  { key: "material-allowance", label: "Material Allowance", Icon: TagIcon },
  { key: "inventory", label: "Inventory", Icon: BoxesIcon },
  { key: "pay-estimate", label: "Pay Estimate", Icon: EstimateIcon },
  { key: "authorizations", label: "Authorizations", Icon: AuthIcon },
] as const;

// Global, contract-independent surfaces (briefs 03 + 11 + 20).
const MATERIALS_NODES = [
  { to: "/materials/inventory", label: "Inventory (search)", Icon: BoxesIcon },
  { to: "/materials/acceptance", label: "Acceptance", Icon: InboxIcon },
  { to: "/samples", label: "Samples", Icon: FlaskIcon },
  { to: "/materials/definitions", label: "Material Definition", Icon: TagIcon },
  { to: "/materials/descriptions", label: "Descriptions", Icon: TagIcon },
  { to: "/materials/vendors", label: "Vendors", Icon: TruckIcon },
  { to: "/materials/inspectors", label: "Inspectors", Icon: UsersIcon },
  { to: "/materials/laboratory", label: "Laboratory", Icon: BeakerIcon },
  { to: "/materials/mix-designs", label: "Mix Design", Icon: BeakerIcon },
] as const;

export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const { contractId } = useParams();
  const contract = useStore((s) => (contractId ? s.contract(contractId) : undefined));
  const contracts = useStore((s) => s.contracts);
  const visibleIds = useStore((s) => s.visibleIds);

  return (
    <>
      {/* backdrop — mobile only, when the drawer is open */}
      <div
        onClick={onClose}
        className={[
          "fixed inset-0 top-[56px] z-30 bg-black/30 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        aria-hidden={!open}
      />
      <aside
        className={[
          "row-span-1 flex w-[252px] flex-col gap-1 overflow-y-auto border-r border-line bg-surface px-3 py-3",
          // off-canvas drawer below lg, static column at lg+
          "fixed inset-y-0 left-0 top-[56px] z-40 transform transition-transform duration-200",
          "lg:static lg:top-0 lg:z-auto lg:w-auto lg:translate-x-0",
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
      {/* close button — mobile drawer only */}
      <button
        onClick={onClose}
        aria-label="Close menu"
        className="mb-1 flex items-center gap-2 self-end rounded-lg px-2 py-1 text-sm text-ink-soft hover:bg-canvas lg:hidden"
      >
        <XIcon className="text-lg" /> Close
      </button>

      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          [
            "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
            isActive ? "bg-accent text-accent-fg" : "text-ink hover:bg-accent-soft",
          ].join(" ")
        }
      >
        <HomeIcon className="text-lg" />
        <span className="flex-1">Home</span>
      </NavLink>

      <NavLink
        to="/my-work"
        className={({ isActive }) =>
          [
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
            isActive ? "bg-accent-soft font-semibold text-accent" : "text-ink-soft hover:bg-canvas hover:text-ink",
          ].join(" ")
        }
      >
        <UsersIcon className="text-lg" />
        <span className="flex-1">My Work</span>
      </NavLink>

      <NavLink
        to="/radar"
        className={({ isActive }) =>
          [
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
            isActive ? "bg-accent-soft font-semibold text-accent" : "text-ink-soft hover:bg-canvas hover:text-ink",
          ].join(" ")
        }
      >
        <InboxIcon className="text-lg" />
        <span className="flex-1">Risk Radar</span>
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
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-5 px-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        Materials
      </div>
      <nav className="mt-1 flex flex-col gap-0.5">
        {MATERIALS_NODES.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                isActive
                  ? "bg-accent-soft font-semibold text-accent"
                  : "text-ink-soft hover:bg-canvas hover:text-ink",
              ].join(" ")
            }
          >
            <Icon className="text-lg" />
            <span className="flex-1">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-3 pt-4 text-[11px] text-ink-faint">
        {visibleIds.size.toLocaleString()} of {contracts.length.toLocaleString()} contracts in scope
      </div>
      </aside>
    </>
  );
}

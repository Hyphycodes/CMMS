import { useState } from "react";
import { useParams } from "react-router-dom";
import { useStore } from "@/store/store";
import { Spinner } from "@/components/ui/Loading";
import { ChevronDown, UsersIcon } from "@/components/ui/icons";
import { ROLE_LABELS } from "@/auth/permissions";
import { ContractSelector } from "./ContractSelector";

export function Header() {
  const { contractId } = useParams();
  const contract = useStore((s) => (contractId ? s.contract(contractId) : undefined));
  const saving = useStore((s) => s.savingCount > 0);
  const dataSourceName = useStore((s) => s.dataSourceName);
  const users = useStore((s) => s.users);
  const currentUser = useStore((s) => s.currentUser);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const [selectorOpen, setSelectorOpen] = useState(false);

  return (
    <header className="col-span-2 flex items-center gap-3 border-b border-line bg-surface px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-fg">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5 9-10" />
          </svg>
        </div>
        <div className="leading-none">
          <div className="text-[15px] font-bold tracking-tight text-ink">Proof</div>
          <div className="text-[10px] text-ink-faint">faster CMMS</div>
        </div>
      </div>

      <div className="mx-1 h-6 w-px bg-line" />

      <button
        onClick={() => setSelectorOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm transition hover:border-line-strong hover:bg-canvas"
      >
        {contract ? (
          <>
            <span className="font-mono font-semibold text-ink">{contract.number}</span>
            <span className="max-w-[280px] truncate text-ink-soft">{contract.name}</span>
          </>
        ) : (
          <span className="text-ink-soft">Select a contract…</span>
        )}
        <ChevronDown className="text-base text-ink-faint" />
      </button>

      <div className="ml-auto flex items-center gap-3">
        {saving && (
          <span className="flex items-center gap-1.5 text-xs text-ink-soft">
            <Spinner className="text-sm" /> Saving…
          </span>
        )}
        {dataSourceName === "local" && currentUser && (
          <label
            className="flex items-center gap-1.5 rounded-lg border border-line bg-canvas px-2 py-1 text-xs text-ink-soft"
            title="Preview a role (dev only — replaced by Supabase Auth in brief 12)"
          >
            <UsersIcon className="text-sm text-ink-faint" />
            <select
              value={currentUser.id}
              onChange={(e) => setCurrentUser(e.target.value)}
              aria-label="Switch role"
              className="bg-transparent font-medium text-ink outline-none"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {ROLE_LABELS[u.roles[0]]}
                </option>
              ))}
            </select>
          </label>
        )}
        <span
          className="rounded-full border border-line bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink-soft"
          title="Active data source (the dataSource seam)"
        >
          {dataSourceName === "local" ? "Local data" : "Supabase"}
        </span>
      </div>

      {selectorOpen && <ContractSelector onClose={() => setSelectorOpen(false)} />}
    </header>
  );
}

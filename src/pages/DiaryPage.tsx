/**
 * Diary (brief 07) — signed daily entries, project log (internal), suspend/resume,
 * weekly report, and date navigation. Replaces the StubPage. Project Log never
 * renders for Contractor scope; unsigned days aren't shared to contractors.
 */
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useStore } from "@/store/store";
import type { DiaryDay } from "@/domain/types";
import { TabBar } from "@/components/ui/TabBar";
import { Pill } from "@/components/ui/Pill";
import { CalendarIcon, SearchIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";

const WEATHER = ["Clear", "Partly Cloudy", "Cloudy", "Rain", "Showers", "Snow", "Windy", "Fog"];
const TABS = ["Summary", "Project Log", "Search"] as const;
type Tab = (typeof TABS)[number];

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number) =>
  new Date(new Date(iso + "T00:00:00").getTime() + n * 86_400_000).toISOString().slice(0, 10);

export function DiaryPage() {
  const { contractId } = useParams();
  const contract = useStore((s) => (contractId ? s.contract(contractId) : undefined));
  const canAccess = useStore((s) => (contractId ? s.canAccessContract(contractId) : false));
  const canAuthor = useStore((s) => s.can("author_contract"));
  const isContractor = useStore((s) => s.currentUser?.roles.includes("Contractor") ?? false);
  const diaryDay = useStore((s) => s.diaryDay);
  const suspensionsByContract = useStore((s) => s.suspensionsByContract);
  const saveDiaryDay = useStore((s) => s.saveDiaryDay);
  const signDiaryDay = useStore((s) => s.signDiaryDay);
  const addSuspension = useStore((s) => s.addSuspension);

  const [date, setDate] = useState(todayISO());
  const [tab, setTab] = useState<Tab>("Summary");
  const [amend, setAmend] = useState(false);

  const day = useMemo(
    () => (contractId ? diaryDay(contractId, date) : undefined),
    [contractId, date, diaryDay],
  );
  const suspensions = contractId ? suspensionsByContract.get(contractId) ?? [] : [];
  const inSuspension = suspensions.find((s) => date >= s.from && (s.to === null || date <= s.to));

  if (!contract) return <div className="grid h-full place-items-center text-ink-soft">Select a contract.</div>;
  if (!canAccess)
    return (
      <div className="grid h-full place-items-center px-6 text-center text-sm text-ink-soft">
        You don't have access to contract {contract.number}.
      </div>
    );
  if (!day) return null;

  const signed = !!day.signedBy;
  const editable = canAuthor && (!signed || amend);
  const visibleTabs = (isContractor ? TABS.filter((t) => t !== "Project Log") : TABS).map((t) => ({ id: t, label: t }));

  const update = (patch: Partial<DiaryDay>) => saveDiaryDay({ ...day, ...patch });

  // contractor sees a signed summary only
  const contractorBlocked = isContractor && !signed;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line bg-surface px-5 pb-3 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-ink">Daily Diary — {contract.number}</h1>
            <p className="text-xs text-ink-soft">{contract.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDate(addDays(date, -1))} className="rounded-lg border border-line px-2 py-1.5 text-sm hover:bg-canvas" aria-label="Previous day">‹</button>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-2 py-1.5">
              <CalendarIcon className="text-base text-ink-faint" />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-sm outline-none" />
            </div>
            <button onClick={() => setDate(addDays(date, 1))} className="rounded-lg border border-line px-2 py-1.5 text-sm hover:bg-canvas" aria-label="Next day">›</button>
            <button onClick={() => setDate(todayISO())} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-canvas">Today</button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {signed ? (
            <Pill tone="green">Signed by {day.signedBy} · {formatDate(day.signedAt)}</Pill>
          ) : (
            <Pill tone="amber">Unsigned</Pill>
          )}
          {inSuspension && <Pill tone="slate">Suspended — {inSuspension.reason}</Pill>}
          <div className="ml-auto flex items-center gap-2">
            {canAuthor && signed && !amend && (
              <button onClick={() => setAmend(true)} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-canvas">
                Amend (audited)
              </button>
            )}
            {canAuthor && !signed && (
              <button
                onClick={() => signDiaryDay(contract.id, date)}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover"
              >
                Sign Daily Diary
              </button>
            )}
            {canAuthor && (
              <SuspendButton onAdd={(from, to, reason) => addSuspension({ contractId: contract.id, from, to, reason })} />
            )}
            <WeeklyReportButton contractId={contract.id} date={date} />
          </div>
        </div>
      </div>

      <TabBar tabs={visibleTabs} active={tab} onChange={setTab} className="px-5" />

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {contractorBlocked ? (
          <p className="text-sm text-ink-soft">This day hasn't been signed yet — it isn't shared until the resident signs it.</p>
        ) : tab === "Summary" ? (
          <SummaryTab day={day} editable={editable} update={update} amended={signed && amend} />
        ) : tab === "Project Log" ? (
          <ProjectLogTab day={day} editable={editable} update={update} />
        ) : (
          <SearchTab contractId={contract.id} onPick={setDate} />
        )}
      </div>
    </div>
  );
}

function SummaryTab({ day, editable, update, amended }: { day: DiaryDay; editable: boolean; update: (p: Partial<DiaryDay>) => void; amended: boolean }) {
  return (
    <div className="max-w-2xl space-y-5">
      {amended && <p className="text-xs text-amber-700">Amending a signed entry — this change is audited.</p>}
      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Weather</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Labeled label="Conditions">
            <select value={day.weather.conditions} disabled={!editable} onChange={(e) => update({ weather: { ...day.weather, conditions: e.target.value } })} className={inp}>
              {WEATHER.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </Labeled>
          <Labeled label="High °F">
            <input type="number" value={day.weather.tempHigh ?? ""} disabled={!editable} onChange={(e) => update({ weather: { ...day.weather, tempHigh: Number(e.target.value) || null } })} className={inp} />
          </Labeled>
          <Labeled label="Low °F">
            <input type="number" value={day.weather.tempLow ?? ""} disabled={!editable} onChange={(e) => update({ weather: { ...day.weather, tempLow: Number(e.target.value) || null } })} className={inp} />
          </Labeled>
          <Labeled label="Weather Note">
            <input value={day.weather.note} disabled={!editable} onChange={(e) => update({ weather: { ...day.weather, note: e.target.value } })} className={inp} />
          </Labeled>
        </div>
      </section>

      <Labeled label="Controlling Item">
        <input value={day.controllingItem} disabled={!editable} onChange={(e) => update({ controllingItem: e.target.value })} className={inp} />
      </Labeled>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Contractor Work (shared once signed)</h3>
          {editable && (
            <button onClick={() => update({ contractorWork: [...day.contractorWork, { contractor: "", summary: "" }] })} className="text-xs text-accent hover:underline">+ Add block</button>
          )}
        </div>
        <div className="space-y-2">
          {day.contractorWork.map((w, i) => (
            <div key={i} className="rounded-lg border border-line p-3">
              <input value={w.contractor} disabled={!editable} placeholder="Contractor" onChange={(e) => update({ contractorWork: day.contractorWork.map((x, j) => (j === i ? { ...x, contractor: e.target.value } : x)) })} className={`${inp} mb-2 font-medium`} />
              <textarea value={w.summary} disabled={!editable} rows={2} placeholder="Work summary" onChange={(e) => update({ contractorWork: day.contractorWork.map((x, j) => (j === i ? { ...x, summary: e.target.value } : x)) })} className="w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70" />
            </div>
          ))}
          {day.contractorWork.length === 0 && <p className="text-sm text-ink-faint">No contractor work recorded.</p>}
        </div>
      </section>
    </div>
  );
}

function ProjectLogTab({ day, editable, update }: { day: DiaryDay; editable: boolean; update: (p: Partial<DiaryDay>) => void }) {
  return (
    <div className="max-w-2xl space-y-2">
      <p className="text-xs text-amber-700">Internal only — never shared with the contractor.</p>
      <textarea
        value={day.projectLog}
        disabled={!editable}
        rows={10}
        placeholder="Internal daily notes…"
        onChange={(e) => update({ projectLog: e.target.value })}
        className="w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70"
      />
    </div>
  );
}

function SearchTab({ contractId, onPick }: { contractId: string; onPick: (date: string) => void }) {
  const diaryRange = useStore((s) => s.diaryRange);
  const [q, setQ] = useState("");
  const days = useMemo(() => {
    const to = todayISO();
    const from = addDays(to, -120);
    return diaryRange(contractId, from, to).reverse();
  }, [contractId, diaryRange]);
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return days.filter((d) => {
      if (!n) return d.signedBy || d.controllingItem;
      return (
        d.controllingItem.toLowerCase().includes(n) ||
        d.contractorWork.some((w) => w.contractor.toLowerCase().includes(n) || w.summary.toLowerCase().includes(n)) ||
        d.date.includes(n)
      );
    });
  }, [days, q]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-1.5 focus-within:border-accent">
        <SearchIcon className="text-base text-ink-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dates, contractor, controlling item, free text…" className="w-96 bg-transparent text-sm outline-none" />
      </div>
      <div className="overflow-hidden rounded-lg border border-line">
        {filtered.slice(0, 80).map((d) => (
          <button key={d.date} onClick={() => onPick(d.date)} className="flex w-full items-center gap-3 border-b border-line/70 px-3 py-2 text-left text-sm transition last:border-b-0 hover:bg-canvas">
            <span className="w-28 font-mono text-xs text-ink-faint">{formatDate(d.date)}</span>
            <span className="min-w-0 flex-1 truncate">{d.controllingItem || "—"}</span>
            {d.signedBy ? <Pill tone="green">Signed</Pill> : <Pill tone="amber">Unsigned</Pill>}
          </button>
        ))}
        {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-ink-soft">No matching diary days.</p>}
      </div>
    </div>
  );
}

function SuspendButton({ onAdd }: { onAdd: (from: string, to: string | null, reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("Winter shutdown");
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-canvas">
        Suspend/Resume
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 space-y-2 rounded-lg border border-line bg-surface p-3 shadow-xl">
          <Labeled label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></Labeled>
          <Labeled label="To (blank = open)"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></Labeled>
          <Labeled label="Reason"><input value={reason} onChange={(e) => setReason(e.target.value)} className={inp} /></Labeled>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-sm text-ink-soft hover:bg-canvas">Cancel</button>
            <button
              onClick={() => { onAdd(from, to || null, reason); setOpen(false); }}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover"
            >
              Add suspension
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function WeeklyReportButton({ contractId, date }: { contractId: string; date: string }) {
  const diaryRange = useStore((s) => s.diaryRange);
  const contract = useStore((s) => s.contract(contractId));
  const generate = () => {
    const end = date;
    const start = addDays(end, -6);
    const days = diaryRange(contractId, start, end);
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return;
    const rows = days
      .map(
        (d) =>
          `<tr><td>${d.date}</td><td>${d.weather.conditions} (${d.weather.tempHigh ?? "—"}/${d.weather.tempLow ?? "—"})</td><td>${d.controllingItem || "—"}</td><td>${d.signedBy ? "Signed — " + d.signedBy : "Unsigned"}</td></tr>`,
      )
      .join("");
    w.document.write(`<!doctype html><title>Weekly Report</title><body style="font-family:ui-sans-serif,system-ui;padding:24px">
      <h2>Weekly Diary Report — ${contract?.number ?? ""}</h2>
      <p>${formatDate(start)} – ${formatDate(end)}</p>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
        <thead><tr style="background:#f2f4f7"><th>Date</th><th>Weather</th><th>Controlling Item</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody></table></body>`);
    w.document.close();
    w.focus();
    w.print();
  };
  return (
    <button onClick={generate} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-canvas">
      Weekly Report
    </button>
  );
}

const inp = "h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent disabled:opacity-70";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="mb-1 block text-xs font-medium text-ink-soft">{label}</label>
      {children}
    </div>
  );
}

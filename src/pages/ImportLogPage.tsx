/**
 * F4 — Import Log surface. Drop a CSV (or load the sample WCTB payload), map
 * columns, preview what will be created / updated / skipped, then commit. Every
 * run is recorded in the log below. Commit writes through the store's optimistic
 * persist, so imports are deltas like everything else.
 */
import { useMemo, useRef, useState } from "react";
import { useStore } from "@/store/store";
import { parseCsv } from "@/data/ingest/sources/csv";
import { parseWctb, SAMPLE_WCTB } from "@/data/ingest/sources/wctb";
import {
  autoMap,
  stageInventory,
  INVENTORY_TARGET_FIELDS,
  type ColumnMapping,
  type RawRow,
  type StageResult,
} from "@/data/ingest/pipeline";
import { Pill } from "@/components/ui/Pill";

const SAMPLE_CSV = `Contract,Material Code,Material Name,Unit,Producer No,Producer,Supplier No,Supplier
61D34,20100100,AGGREGATE BASE COURSE,TON,2112-14,Vulcan Materials,2112-14,Vulcan Materials
61D34,44000100,HMA SURFACE COURSE,TON,3041-02,Gallagher Asphalt,3041-02,Gallagher Asphalt
61D34,67100100,MOBILIZATION,L SUM,,,,`;

export function ImportLogPage() {
  const contracts = useStore((s) => s.contracts);
  const items = useStore((s) => s.items);
  const commitImport = useStore((s) => s.commitInventoryImport);
  const log = useStore((s) => s.importLogList);
  const canImport = useStore((s) => s.can("create_inventory"));
  const fileRef = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState("csv");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});

  const contractIdForNumber = useMemo(() => {
    const m = new Map(contracts.map((c) => [c.number, c.id]));
    return (num: string) => m.get(num);
  }, [contracts]);

  const result: StageResult | null = useMemo(
    () => (rows.length ? stageInventory(rows, mapping, items, contractIdForNumber) : null),
    [rows, mapping, items, contractIdForNumber],
  );

  const ingestCsv = (text: string, name: string) => {
    const { headers, rows } = parseCsv(text);
    setHeaders(headers);
    setRows(rows);
    setMapping(autoMap(headers));
    setFileName(name);
    setSource("csv");
  };
  const ingestWctb = () => {
    const { headers, rows } = parseWctb(SAMPLE_WCTB);
    setHeaders(headers);
    setRows(rows);
    setMapping(autoMap(headers));
    setFileName("sample-wctb.json");
    setSource("wctb");
  };

  const commit = () => {
    if (!result) return;
    const toCommit = result.rows.filter((r) => (r.action === "create" || r.action === "update") && r.item).map((r) => r.item!);
    commitImport(toCommit, {
      source,
      fileName,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.rows.filter((r) => r.action === "error").map((r) => r.error ?? "error").slice(0, 20),
    });
    setRows([]);
    setHeaders([]);
    setFileName("");
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-5 px-6 py-6">
        <div>
          <h1 className="text-lg font-semibold text-ink">Import Log</h1>
          <p className="text-sm text-ink-soft">One ingestion pipeline for every source — parse → map → preview → commit. Imports land as deltas.</p>
        </div>

        {!canImport && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Your role can't import inventory.</p>}

        {/* Source + parse */}
        <section className="rounded-card border border-line bg-surface p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button onClick={() => fileRef.current?.click()} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover">Choose CSV…</button>
            <button onClick={() => ingestCsv(SAMPLE_CSV, "sample.csv")} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-canvas">Load sample CSV</button>
            <button onClick={ingestWctb} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-canvas">Load sample WCTB payload</button>
            {fileName && <span className="text-sm text-ink-soft">· {fileName} ({rows.length} rows, source {source})</span>}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) f.text().then((t) => ingestCsv(t, f.name));
                e.target.value = "";
              }}
            />
          </div>

          {/* Column mapping */}
          {headers.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {INVENTORY_TARGET_FIELDS.map((field) => (
                <label key={field} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-ink-soft">{field}</span>
                  <select
                    value={mapping[field] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value || undefined }))}
                    className="rounded-md border border-line bg-surface px-2 py-1 text-sm outline-none"
                  >
                    <option value="">—</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* Preview */}
        {result && (
          <section className="rounded-card border border-line bg-surface p-4">
            <div className="mb-2 flex items-center gap-3">
              <span className="text-sm font-semibold text-ink">Preview</span>
              <Pill tone="green">{result.created} create</Pill>
              <Pill tone="blue">{result.updated} update</Pill>
              <Pill tone="slate">{result.skipped} skip</Pill>
              {result.errors > 0 && <Pill tone="red">{result.errors} error</Pill>}
              <button
                onClick={commit}
                disabled={!canImport || result.created + result.updated === 0}
                className="ml-auto rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
              >
                Commit import
              </button>
            </div>
            <div className="max-h-[320px] overflow-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-canvas text-left text-[11px] uppercase tracking-wide text-ink-faint">
                  <tr>
                    <th className="px-3 py-1.5">Action</th>
                    <th className="px-3 py-1.5">Contract</th>
                    <th className="px-3 py-1.5">Material</th>
                    <th className="px-3 py-1.5">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 200).map((r, i) => (
                    <tr key={i} className="border-t border-line/70">
                      <td className="px-3 py-1.5">
                        <Pill tone={r.action === "create" ? "green" : r.action === "update" ? "blue" : r.action === "skip" ? "slate" : "red"}>{r.action}</Pill>
                      </td>
                      <td className="px-3 py-1.5">{r.item?.contractNumber ?? "—"}</td>
                      <td className="px-3 py-1.5"><span className="font-mono text-[12px]">{r.item?.materialCode ?? "—"}</span> {r.item?.materialName ?? ""}</td>
                      <td className="px-3 py-1.5 text-ink-faint">{r.error ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Past runs */}
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Import runs ({log.length})</h2>
          {log.length === 0 ? (
            <p className="text-sm text-ink-faint">No imports yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-2 py-1.5">When</th>
                  <th className="px-2 py-1.5">Source</th>
                  <th className="px-2 py-1.5">File</th>
                  <th className="px-2 py-1.5">By</th>
                  <th className="px-2 py-1.5 text-right">Created</th>
                  <th className="px-2 py-1.5 text-right">Updated</th>
                  <th className="px-2 py-1.5 text-right">Skipped</th>
                  <th className="px-2 py-1.5 text-right">Errors</th>
                </tr>
              </thead>
              <tbody>
                {log.map((e) => (
                  <tr key={e.id} className="border-t border-line/70">
                    <td className="px-2 py-1.5">{new Date(e.at).toLocaleString()}</td>
                    <td className="px-2 py-1.5 uppercase">{e.source}</td>
                    <td className="px-2 py-1.5">{e.fileName}</td>
                    <td className="px-2 py-1.5">{e.by}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{e.created}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{e.updated}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{e.skipped}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{e.errors.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

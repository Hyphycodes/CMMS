/**
 * S1 — the one file affordance reused at every `[D]` doc site (EOI Docs, Project
 * Documents, Diary attachments, Authorization BC-24, Mix Design). Drag/drop or
 * pick a file; it uploads in the background (object-URL / Storage) and only a
 * reference lands in the delta. Lists existing files as removable rows —
 * name · size · who/when · download · ✕. Never a checkmark.
 */
import { useRef, useState } from "react";
import { useStore } from "@/store/store";
import type { FileScope } from "@/data/dataSource";
import type { StoredFileRef } from "@/domain/types";
import { FileIcon, XIcon } from "@/components/ui/icons";

/** Stable empty reference so the selector never returns a fresh array (no render loop). */
const EMPTY_FILES: StoredFileRef[] = [];

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileDrop({
  scope,
  disabled,
  label = "Attach a document",
  compact,
}: {
  scope: FileScope;
  disabled?: boolean;
  label?: string;
  compact?: boolean;
}) {
  const key = `${scope.entity}:${scope.entityId}`;
  const files = useStore((s) => s.fileRefs[key] ?? EMPTY_FILES);
  const uploadFiles = useStore((s) => s.uploadFiles);
  const removeFile = useStore((s) => s.removeFile);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const onPick = (list: FileList | null) => {
    if (!list || disabled) return;
    uploadFiles(scope, Array.from(list));
  };

  return (
    <div className="flex flex-col gap-2">
      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm"
            >
              <FileIcon className="shrink-0 text-base text-ink-faint" />
              <div className="min-w-0 flex-1">
                {f.uploading ? (
                  <span className="truncate font-medium text-ink-soft">{f.name}</span>
                ) : (
                  <a
                    href={f.url}
                    download={f.name}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate font-medium text-accent hover:underline"
                  >
                    {f.name}
                  </a>
                )}
                <div className="text-[11px] text-ink-faint">
                  {f.uploading ? (
                    <span className="text-amber-700">uploading…</span>
                  ) : (
                    <>
                      {humanSize(f.size)}
                      {f.uploadedBy ? ` · ${f.uploadedBy}` : ""}
                      {f.uploadedAt ? ` · ${f.uploadedAt.slice(0, 10)}` : ""}
                    </>
                  )}
                </div>
              </div>
              {!disabled && !f.uploading && (
                <button
                  onClick={() => removeFile(scope, f)}
                  aria-label={`Remove ${f.name}`}
                  className="rounded p-1 text-ink-faint hover:bg-canvas hover:text-red-600"
                >
                  <XIcon className="text-sm" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!disabled && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onPick(e.dataTransfer.files);
          }}
          className={`flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 ${
            compact ? "py-1.5 text-xs" : "py-3 text-sm"
          } transition ${dragOver ? "border-accent bg-accent/5 text-accent" : "border-line text-ink-soft hover:border-line-strong"}`}
        >
          <button onClick={() => inputRef.current?.click()} className="font-medium text-accent hover:underline">
            {label}
          </button>
          <span className="hidden text-ink-faint sm:inline">or drop a file</span>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}

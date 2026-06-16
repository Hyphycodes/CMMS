import { Link, useParams } from "react-router-dom";
import { useStore } from "@/store/store";

/** A present-but-out-of-scope tree node. Clearly disabled — no fake buttons. */
export function StubPage({ node }: { node: string }) {
  const { contractId } = useParams();
  const contract = useStore((s) => (contractId ? s.contract(contractId) : undefined));

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink-faint">
        Not in this build
      </div>
      <h1 className="text-2xl font-semibold text-ink">{node}</h1>
      <p className="max-w-md text-sm text-ink-soft">
        This node exists in the workflow and the tree, but isn't part of the two hero screens
        shipped first. The data model and navigation are wired so it can be built next without
        disrupting the loop.
      </p>
      {contract && (
        <Link
          to={`/contract/${contract.id}/inventory`}
          className="mt-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover"
        >
          Go to Inventory
        </Link>
      )}
    </div>
  );
}

/**
 * M5 — Employee / security admin (manual Appendix A). A DistrictAdmin-only surface
 * to add/modify employees, set roles + district scope + party, and toggle active.
 * Changes drive can() and visibleContractIds(); RLS (P5) is the real wall.
 */
import { useState } from "react";
import { useStore } from "@/store/store";
import { ROLES, PARTIES, type Role, type Party, type User } from "@/domain/types";
import { ROLE_LABELS } from "@/auth/permissions";
import { Pill } from "@/components/ui/Pill";

export function EmployeesPage() {
  const users = useStore((s) => s.users);
  const upsertUser = useStore((s) => s.upsertUser);
  const canManage = useStore((s) => s.can("manage_users"));
  const [editing, setEditing] = useState<User | null>(null);

  if (!canManage) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-sm text-ink-soft">
        Employee administration is restricted to District Admins.
      </div>
    );
  }

  const blank = (): User => ({
    id: `u_new_${Date.now()}`,
    name: "",
    roles: ["Inspector"],
    districtIds: [],
    contractIds: [],
    orgId: "IDOT",
    party: "IDOT",
    active: true,
    title: "",
    email: "",
  });

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 px-6 py-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-lg font-semibold text-ink">Employees</h1>
            <p className="text-sm text-ink-soft">Add or modify employees, roles, scope, and party (Appendix A).</p>
          </div>
          <button onClick={() => setEditing(blank())} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover">+ Add employee</button>
        </div>

        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-canvas text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Roles</th>
                <th className="px-4 py-2">Party / Org</th>
                <th className="px-4 py-2">Scope</th>
                <th className="px-4 py-2">Active</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-line/70">
                  <td className="px-4 py-2">
                    <div className="font-medium text-ink">{u.name}</div>
                    <div className="text-xs text-ink-faint">{u.title}</div>
                  </td>
                  <td className="px-4 py-2 text-ink-soft">{u.roles.map((r) => ROLE_LABELS[r]).join(", ")}</td>
                  <td className="px-4 py-2 text-ink-soft">{u.party} · {u.orgId}</td>
                  <td className="px-4 py-2 text-ink-soft">{u.districtIds.length ? `Districts ${u.districtIds.join(", ")}` : `${u.contractIds.length} contracts`}</td>
                  <td className="px-4 py-2">{u.active === false ? <Pill tone="slate">Inactive</Pill> : <Pill tone="green">Active</Pill>}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setEditing(u)} className="text-xs font-medium text-accent hover:underline">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EmployeeForm
          user={editing}
          onClose={() => setEditing(null)}
          onSave={(u) => {
            upsertUser(u);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EmployeeForm({ user, onClose, onSave }: { user: User; onClose: () => void; onSave: (u: User) => void }) {
  const [name, setName] = useState(user.name);
  const [title, setTitle] = useState(user.title ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [roles, setRoles] = useState<Role[]>(user.roles);
  const [party, setParty] = useState<Party>(user.party);
  const [orgId, setOrgId] = useState(user.orgId);
  const [active, setActive] = useState(user.active !== false);
  const [districts, setDistricts] = useState(user.districtIds.join(", "));

  const toggleRole = (r: Role) => setRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));

  const save = () =>
    onSave({
      ...user,
      name: name.trim() || "Unnamed",
      title,
      email,
      roles: roles.length ? roles : ["Inspector"],
      party,
      orgId,
      active,
      districtIds: districts.split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n) && n > 0),
    });

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/20 p-4" onClick={onClose}>
      <div className="w-[520px] max-w-full rounded-xl border border-line bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-ink">{user.name ? `Edit ${user.name}` : "Add employee"}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={inp} /></Field>
          <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} /></Field>
          <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} className={inp} /></Field>
          <Field label="Party">
            <select value={party} onChange={(e) => setParty(e.target.value as Party)} className={inp}>
              {PARTIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Org ID"><input value={orgId} onChange={(e) => setOrgId(e.target.value)} className={inp} /></Field>
          <Field label="District scope (comma)"><input value={districts} onChange={(e) => setDistricts(e.target.value)} placeholder="e.g. 1, 2" className={inp} /></Field>
        </div>
        <div className="mt-3">
          <div className="mb-1 text-xs font-medium text-ink-soft">Roles</div>
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((r) => (
              <button key={r} onClick={() => toggleRole(r)} className={`rounded-md border px-2 py-1 text-xs font-medium ${roles.includes(r) ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-soft hover:bg-canvas"}`}>
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-accent" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:bg-canvas">Cancel</button>
          <button onClick={save} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover">Save</button>
        </div>
      </div>
    </div>
  );
}

const inp = "h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

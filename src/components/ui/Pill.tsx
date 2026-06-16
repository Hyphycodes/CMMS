import { pillClass, type PillTone } from "@/domain/status";

export function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return <span className={pillClass(tone)}>{children}</span>;
}

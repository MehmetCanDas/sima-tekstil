import { statusOf } from "@/lib/admin/format";

const TONE_CLASS = {
  ok: "a-badge-ok",
  warn: "a-badge-warn",
  bad: "a-badge-bad",
  mute: "a-badge-mute",
} as const;

export function Badge({
  tone = "mute",
  children,
}: {
  tone?: keyof typeof TONE_CLASS;
  children: React.ReactNode;
}) {
  return <span className={`a-badge ${TONE_CLASS[tone]}`}>{children}</span>;
}

/** Durum kodunu etiketli rozete cevirir. */
export function StatusBadge({
  map,
  value,
}: {
  map: Record<string, { label: string; tone: string }>;
  value: string;
}) {
  const { label, tone } = statusOf(map, value);
  return <Badge tone={tone}>{label}</Badge>;
}

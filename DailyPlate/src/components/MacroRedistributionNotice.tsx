import { X } from "lucide-react";
import { SmartAdjustmentBadge } from "@/components/SmartAdjustmentBadge";

const NOTICE_TEXT =
  "Macros adjusted to meet your minimum protein goal while keeping meals realistic.";

export function MacroRedistributionNotice({
  onDismiss,
}: {
  onDismiss: () => void;
}) {
  return (
    <div
      className="section-gap flex gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-4"
      role="status"
    >
      <div className="min-w-0 flex-1 space-y-2">
        <SmartAdjustmentBadge variant="info">Smart adjustment</SmartAdjustmentBadge>
        <p className="text-sm leading-relaxed text-slate-700">{NOTICE_TEXT}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-white/80"
        aria-label="Dismiss notice"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

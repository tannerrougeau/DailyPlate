import { X } from "lucide-react";
import { SmartAdjustmentBadge } from "@/components/SmartAdjustmentBadge";

export function PersonalizationInsightBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="section-gap card-surface flex gap-3 px-4 py-4">
      <div className="min-w-0 flex-1 space-y-2">
        <SmartAdjustmentBadge variant="info">Personalized for you</SmartAdjustmentBadge>
        <p className="text-sm leading-relaxed text-slate-700">{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label="Dismiss personalization note"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

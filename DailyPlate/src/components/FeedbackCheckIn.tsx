import { MessageCircle } from "lucide-react";

export function FeedbackCheckInButton({
  onOpen,
  variant = "subtle",
  due = false,
}: {
  onOpen: () => void;
  variant?: "subtle" | "card";
  due?: boolean;
}) {
  if (variant === "card") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="relative flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300"
      >
        <MessageCircle className="h-4 w-4 text-[#2563EB]" aria-hidden />
        Check-in
        {due && (
          <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-[#2563EB]" aria-label="Check-in due" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative flex min-h-[32px] items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900"
    >
      <MessageCircle className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden />
      Check-in
      {due && (
        <span className="h-2 w-2 rounded-full bg-[#2563EB]" aria-label="Check-in due" />
      )}
    </button>
  );
}

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

type LoginScreenProps = {
  onBack: () => void;
  onCreateAccount: () => void;
};

export function LoginScreen({ onBack, onCreateAccount }: LoginScreenProps) {
  const login = useAppStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (result === "ok") return;
    if (result === "not-found") {
      setError("No account found for that email. Create a plan to get started.");
      return;
    }
    setError("Incorrect password. Try again or create a new account.");
  }

  return (
    <div className="min-h-dvh bg-[#f5f5f4] px-4 pb-10 pt-8">
      <div className="mx-auto max-w-lg">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 flex min-h-[44px] items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-600 hover:bg-white/80"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </button>

        <div className="rounded-3xl border border-slate-200/80 bg-white px-6 py-10 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-2 text-base leading-relaxed text-slate-600">
            Log in to pick up your meal plans and preferences.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-[52px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base text-slate-900 outline-none focus:border-[#2563EB]"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-[52px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base text-slate-900 outline-none focus:border-[#2563EB]"
                placeholder="Your password"
              />
            </div>

            {error && (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="min-h-[56px] w-full rounded-2xl bg-[#2563EB] py-4 text-lg font-semibold text-white shadow-md disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Log in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          New to DailyPlate?{" "}
          <button
            type="button"
            onClick={onCreateAccount}
            className="font-semibold text-[#2563EB] underline-offset-2 hover:underline"
          >
            Create your plan
          </button>
        </p>
      </div>
    </div>
  );
}

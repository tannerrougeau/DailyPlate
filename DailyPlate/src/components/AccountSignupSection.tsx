import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";

export function AccountSignupSection({
  title = "Save your account",
}: {
  title?: string;
}) {
  const registerAccount = useAppStore((s) => s.registerAccount);
  const login = useAppStore((s) => s.login);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    const trimmed = email.trim();
    if (!trimmed || password.length < 6) {
      setError("Use a valid email and password (6+ characters).");
      return;
    }
    setBusy(true);
    setError(null);
    const result =
      mode === "signup" ? await registerAccount(trimmed, password) : await login(trimmed, password);
    setBusy(false);
    if (result === "exists") {
      setError("That email already has an account. Log in instead.");
      return;
    }
    if (result === "not-found") {
      setError("No account for that email. Create one instead.");
      return;
    }
    if (result === "invalid") {
      setError("Use a valid email and password (6+ characters).");
      return;
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600">
        Add an email and password so you can log in on this or another device.
      </p>
      <input
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="min-h-[48px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base text-slate-900 outline-none focus:border-[#2563EB]"
      />
      <input
        type="password"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password (6+ characters)"
        className="min-h-[48px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base text-slate-900 outline-none focus:border-[#2563EB]"
      />
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleSubmit()}
        className="min-h-[48px] w-full rounded-2xl bg-[#2563EB] py-2.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        {mode === "signup" ? "Create account" : "Log in"}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "signup" ? "login" : "signup"));
          setError(null);
        }}
        className="w-full text-sm font-medium text-slate-500 underline-offset-2 hover:underline"
      >
        {mode === "signup" ? "I already have an account — log in" : "Need an account? Sign up"}
      </button>
    </section>
  );
}

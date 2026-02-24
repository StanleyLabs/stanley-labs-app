import { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router-dom";

export default function Login() {
  const { user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-electric/30 border-t-electric" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6">
        <div className="flex items-center gap-3 mb-4">
          {user.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="" className="h-10 w-10 rounded-full" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-electric/20 text-sm font-medium text-electric">
              {(user.email?.[0] ?? "?").toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-paper">{user.user_metadata?.full_name ?? user.email}</p>
            {user.user_metadata?.full_name && (
              <p className="text-xs text-fog/40">{user.email}</p>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <Link to="/" className="rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white hover:bg-electric/90 transition-colors">
            Go to Home
          </Link>
          <button
            onClick={async () => { await signOut(); }}
            className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm font-medium text-fog/60 hover:bg-white/[0.05] hover:text-paper transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    if (isSignUp) {
      const { error } = await signUpWithEmail(email, password);
      if (error) {
        setError(error);
      } else {
        setMessage("Check your email for a confirmation link.");
      }
    } else {
      const { error } = await signInWithEmail(email, password);
      if (error) setError(error);
    }

    setSubmitting(false);
  };

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-electric/10">
            <svg
              className="h-6 w-6 text-electric"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="font-display text-xl font-bold text-paper">
            {isSignUp ? "Create an account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-fog/50">
            {isSignUp ? "Sign up to get started" : "Sign in to Stanley Labs"}
          </p>
        </div>

        {/* OAuth buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={signInWithGoogle}
            className="flex items-center justify-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-paper transition-all hover:bg-white/[0.06]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/[0.06]" />
          <span className="text-xs text-fog/30">or</span>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>

        {/* Email form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-paper placeholder:text-fog/30 outline-none focus:border-electric/50 transition-colors"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-paper placeholder:text-fog/30 outline-none focus:border-electric/50 transition-colors"
          />

          {error && (
            <p className="text-xs text-signal">{error}</p>
          )}
          {message && (
            <p className="text-xs text-emerald-400">{message}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-electric px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-electric/90 disabled:opacity-50"
          >
            {submitting
              ? "..."
              : isSignUp
              ? "Create account"
              : "Sign in"}
          </button>
        </form>

        {/* Toggle sign up / sign in */}
        <p className="mt-6 text-center text-xs text-fog/40">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => {
              setIsSignUp((v) => !v);
              setError(null);
              setMessage(null);
            }}
            className="text-electric hover:underline"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}

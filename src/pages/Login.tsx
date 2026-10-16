import { useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import {
	btnGhost,
	btnPrimary,
	card,
	cn,
	input,
	label,
	tabBar,
	tabItem,
} from "../components/ui/styles"
import { useAuth } from "../lib/auth"

export default function Login() {
	const { user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth()
	const navigate = useNavigate()
	const [isSignUp, setIsSignUp] = useState(false)
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [showPassword, setShowPassword] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [submitting, setSubmitting] = useState(false)

	if (!loading && user) return <Navigate to="/" replace />

	const switchMode = (signUp: boolean) => {
		setIsSignUp(signUp)
		setError(null)
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		setSubmitting(true)
		const { error } = isSignUp
			? await signUpWithEmail(email, password)
			: await signInWithEmail(email, password)
		if (error) {
			setError(error)
			setSubmitting(false)
			return
		}
		navigate("/")
	}

	return (
		<div className="grain h-full overflow-hidden bg-ink [color-scheme:dark]">
			<div className="h-full">
				<div className="pointer-events-none absolute inset-0 overflow-hidden">
					<div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-electric/[0.12] blur-3xl" />
					<div className="absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-violet-500/[0.06] blur-3xl" />
					<div className="absolute -right-24 top-1/2 h-80 w-80 rounded-full bg-amber-400/[0.05] blur-3xl" />
				</div>

				<div className="subtle-scroll relative flex h-full flex-col overflow-y-auto">
					<header className="mx-auto flex w-full max-w-5xl shrink-0 items-center justify-between px-4 py-4 sm:px-6">
						<Link to="/" className="flex items-center gap-2.5">
							<img src="/favicon.svg" alt="" className="h-8 w-8 rounded-lg" />
							<span className="font-display text-sm font-semibold tracking-tight text-paper">
								Stanley Labs
							</span>
						</Link>
						<Link
							to="/"
							className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-fog/70 backdrop-blur-xl transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-paper"
						>
							<svg
								className="h-4 w-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d="M19 12H5M12 19l-7-7 7-7" />
							</svg>
							Back
						</Link>
					</header>

					<main className="flex flex-1 items-center justify-center px-4 py-8">
						{loading ? (
							<div className="h-6 w-6 animate-spin rounded-full border-2 border-electric/30 border-t-electric" />
						) : (
							<div className="w-full max-w-sm animate-slide-up">
								<div className="mb-6 text-center">
									<h1 className="font-display text-2xl font-bold tracking-tight text-paper sm:text-3xl">
										{isSignUp ? "Create your account" : "Welcome back"}
										<span className="text-electric">.</span>
									</h1>
									<p className="mt-1.5 text-sm text-fog/50">
										{isSignUp
											? "Sync your projects, time, and boards across devices."
											: "Sign in to sync your workspace."}
									</p>
								</div>

								<div className={cn(card, "p-5 shadow-2xl shadow-black/40 sm:p-6")}>
									<div className={cn(tabBar, "mb-5")} role="tablist">
										<button
											type="button"
											role="tab"
											aria-selected={!isSignUp}
											onClick={() => switchMode(false)}
											className={cn(tabItem(!isSignUp), "flex-1 justify-center py-2")}
										>
											Sign in
										</button>
										<button
											type="button"
											role="tab"
											aria-selected={isSignUp}
											onClick={() => switchMode(true)}
											className={cn(tabItem(isSignUp), "flex-1 justify-center py-2")}
										>
											Sign up
										</button>
									</div>

									<button
										type="button"
										onClick={signInWithGoogle}
										className={cn(btnGhost, "w-full gap-2.5 py-2.5 text-paper")}
									>
										<GoogleIcon />
										Continue with Google
									</button>

									<div className="my-5 flex items-center gap-3">
										<div className="h-px flex-1 bg-white/[0.08]" />
										<span className="text-[10px] font-semibold uppercase tracking-wider text-fog/35">
											or with email
										</span>
										<div className="h-px flex-1 bg-white/[0.08]" />
									</div>

									<form onSubmit={handleSubmit} className="flex flex-col gap-4">
										<div>
											<label htmlFor="login-email" className={label}>
												Email
											</label>
											<input
												id="login-email"
												type="email"
												autoComplete="email"
												placeholder="you@example.com"
												value={email}
												onChange={(e) => setEmail(e.target.value)}
												required
												className={cn(input, "py-2.5")}
											/>
										</div>
										<div>
											<label htmlFor="login-password" className={label}>
												Password
											</label>
											<div className="relative">
												<input
													id="login-password"
													type={showPassword ? "text" : "password"}
													autoComplete={isSignUp ? "new-password" : "current-password"}
													placeholder={isSignUp ? "At least 8 characters" : "••••••••"}
													value={password}
													onChange={(e) => setPassword(e.target.value)}
													required
													minLength={8}
													className={cn(input, "py-2.5 pr-10")}
												/>
												<button
													type="button"
													onClick={() => setShowPassword((v) => !v)}
													className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-fog/40 transition-colors hover:bg-white/10 hover:text-paper"
													aria-label={showPassword ? "Hide password" : "Show password"}
													title={showPassword ? "Hide password" : "Show password"}
												>
													<EyeIcon off={showPassword} />
												</button>
											</div>
										</div>

										{error && (
											<div
												role="alert"
												className="flex items-start gap-2 rounded-lg border border-signal/30 bg-signal/10 px-3 py-2 text-xs text-red-200 animate-fade-in"
											>
												<svg
													className="mt-px h-3.5 w-3.5 shrink-0 text-signal"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="2.5"
													strokeLinecap="round"
													strokeLinejoin="round"
													aria-hidden="true"
												>
													<circle cx="12" cy="12" r="9" />
													<path d="M12 8v4M12 16h.01" />
												</svg>
												<span>{error}</span>
											</div>
										)}

										<button
											type="submit"
											disabled={submitting}
											className={cn(btnPrimary, "mt-1 w-full py-2.5")}
										>
											{submitting && (
												<span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
											)}
											{isSignUp ? "Create account" : "Sign in"}
										</button>
									</form>
								</div>

								<p className="mt-5 text-center text-xs text-fog/40">
									No account needed to try things out —{" "}
									<Link
										to="/"
										className="font-medium text-fog/70 transition-colors hover:text-paper"
									>
										continue as a guest
									</Link>
									.
								</p>
							</div>
						)}
					</main>

					<footer className="flex shrink-0 justify-center px-6 pb-6 text-xs text-fog/35">
						<Link to="/privacy" className="transition-colors hover:text-fog/70">
							Privacy
						</Link>
					</footer>
				</div>
			</div>
		</div>
	)
}

function EyeIcon({ off }: { off: boolean }) {
	return (
		<svg
			className="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{off ? (
				<>
					<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24" />
					<path d="M1 1l22 22" />
				</>
			) : (
				<>
					<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
					<circle cx="12" cy="12" r="3" />
				</>
			)}
		</svg>
	)
}

function GoogleIcon() {
	return (
		<svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
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
	)
}

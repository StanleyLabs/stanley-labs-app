import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { card, cn } from "../components/ui/styles"

const SECTIONS: { title: string; body: ReactNode }[] = [
	{
		title: "Two ways to use the app",
		body: (
			<>
				Stanley Labs App works signed in (synced to the cloud) or as a guest (saved in your
				browser). You can try everything without an account.
			</>
		),
	},
	{
		title: "Signed in",
		body: (
			<>
				Your data is stored on our own self-hosted PocketBase server, which handles the database
				and authentication, so it can sync across your devices. If you sign in with Google, we
				receive your name, email, and profile picture from Google to set up your account.
			</>
		),
	},
	{
		title: "As a guest",
		body: (
			<>
				Your data never leaves your device. It stays in your browser&apos;s local storage, so
				clearing your browser data will remove it.
			</>
		),
	},
	{
		title: "Storage",
		body: (
			<>
				We only use essential storage needed for the app to work, such as keeping you signed in
				and remembering your settings.
			</>
		),
	},
	{
		title: "Video chat",
		body: (
			<>
				Calls use WebRTC. Audio and video are processed in your browser and sent directly to the
				other participants. A public STUN server (provided by Google) is used only to help devices
				find each other; it does not receive your media.
			</>
		),
	},
	{
		title: "Your data, your control",
		body: (
			<>
				You can export projects and whiteboards to JSON at any time and import them again later.
			</>
		),
	},
	{
		title: "No tracking",
		body: <>No ads, no analytics, and no marketing trackers.</>,
	},
]

export default function Privacy() {
	return (
		<div className="grain h-full overflow-hidden bg-ink [color-scheme:dark]">
			<div className="h-full">
				<div className="pointer-events-none absolute inset-0 overflow-hidden">
					<div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-electric/[0.12] blur-3xl" />
					<div className="absolute -left-24 top-1/2 h-80 w-80 rounded-full bg-violet-500/[0.06] blur-3xl" />
					<div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-amber-400/[0.05] blur-3xl" />
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

					<main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
						<div className="mb-8 animate-slide-up">
							<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fog/40">
								Last updated October 16, 2026
							</p>
							<h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-paper sm:text-4xl">
								Privacy<span className="text-electric">.</span>
							</h1>
							<p className="mt-3 max-w-lg text-sm text-fog/55 sm:text-base">
								The short version: your data is yours, and we don&apos;t track you.
							</p>
						</div>

						<div
							className={cn(
								card,
								"divide-y divide-white/[0.06] shadow-2xl shadow-black/40 animate-slide-up",
							)}
							style={{ animationDelay: "60ms", animationFillMode: "backwards" }}
						>
							{SECTIONS.map((s) => (
								<section key={s.title} className="p-5 sm:p-6">
									<h2 className="font-display text-base font-semibold text-paper">{s.title}</h2>
									<p className="mt-1.5 text-sm leading-relaxed text-fog/60">{s.body}</p>
								</section>
							))}
						</div>
					</main>

					<footer className="flex shrink-0 justify-center px-6 pb-6 text-xs text-fog/35">
						<span>Built by Stanley Labs</span>
					</footer>
				</div>
			</div>
		</div>
	)
}

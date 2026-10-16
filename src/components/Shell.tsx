import { type ReactNode, useState, useRef, useEffect } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { useRunningTimer } from "../lib/runningTimer"
import { RunningTimerPill } from "./RunningTimerPill"

const navItems = [
	{ to: "/", label: "Home", icon: HomeIcon, gradient: "from-slate-500 to-slate-700" },
	{ to: "/tasks", label: "Tasks", icon: TasksIcon, gradient: "from-violet-500 to-indigo-500" },
	{ to: "/time", label: "Time", icon: TimeIcon, gradient: "from-amber-400 to-orange-500" },
	{ to: "/boards", label: "Boards", icon: BoardsIcon, gradient: "from-emerald-400 to-teal-500" },
	{ to: "/chat", label: "Chat", icon: ChatIcon, gradient: "from-electric to-sky-400" },
]

export function Shell({ children }: { children: ReactNode }) {
	const { pathname } = useLocation()
	const isHome = pathname === "/"
	const isLogin = pathname === "/login"
	const isChat = pathname.startsWith("/chat")
	const isBoards = pathname.startsWith("/boards")
	const isTime = pathname.startsWith("/time")
	const { running } = useRunningTimer()
	const showPill = !!running && !isHome && !isLogin && !isTime
	// Boards and Chat have controls along the bottom, so the nav sits at the top there.
	// Chat's offset clears its 65px room top bar.
	const topAnchored = isBoards || isChat
	const navPos = isBoards
		? "top-[21px] flex-col sm:right-[175px]"
		: isChat
			? "top-[81px] flex-col"
			: "bottom-4 flex-col-reverse"
	const pillPos = isBoards ? "top-[21px] sm:right-[223px]" : isChat ? "top-[81px]" : "bottom-4"
	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	// Close when clicking outside
	useEffect(() => {
		if (!open) return
		function handleClick(e: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false)
			}
		}
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false)
		}
		document.addEventListener("mousedown", handleClick)
		document.addEventListener("keydown", handleKey)
		return () => {
			document.removeEventListener("mousedown", handleClick)
			document.removeEventListener("keydown", handleKey)
		}
	}, [open])

	// Close on route change
	useEffect(() => {
		setOpen(false)
	}, [pathname])

	return (
		<div className="flex h-full flex-col bg-ink">
			{/* Floating nav */}
			{!isHome && !isLogin && (
				<div
					ref={containerRef}
					className={`pointer-events-none fixed right-4 z-[9999] flex items-end${isChat ? " landscape-hide" : ""} ${navPos}`}
				>
					{/* Main toggle button */}
					<button
						onClick={() => setOpen((v) => !v)}
						className={`pointer-events-auto relative flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-xl shadow-lg shadow-black/40 transition-all duration-200 ${
							open
								? "border-electric bg-electric text-white shadow-glow-electric"
								: "border-white/10 bg-ink/80 text-electric hover:border-white/20 hover:bg-graphite/90 hover:shadow-glow-electric"
						}`}
						title="Stanley Labs apps"
						aria-label={open ? "Close app menu" : "Open app menu"}
						aria-expanded={open}
					>
						<svg
							className={`absolute h-[18px] w-[18px] transition-all duration-200 ${
								open ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
							}`}
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d="M12 2L2 7l10 5 10-5-10-5z" />
							<path d="M2 17l10 5 10-5" />
							<path d="M2 12l10 5 10-5" />
						</svg>
						<svg
							className={`absolute h-4 w-4 transition-all duration-200 ${
								open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
							}`}
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.25"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>

					{/* App menu */}
					<div
						className={`w-40 overflow-hidden rounded-2xl border border-white/10 bg-ink/85 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-200 ease-out ${
							topAnchored ? "mt-2 origin-top-right" : "mb-2 origin-bottom-right"
						} ${
							open
								? "pointer-events-auto scale-100 opacity-100"
								: `pointer-events-none scale-95 opacity-0 ${topAnchored ? "-translate-y-1" : "translate-y-1"}`
						}`}
						aria-hidden={!open}
					>
						<div className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-fog/40">
							Stanley Labs
						</div>
						{navItems.map(({ to, label, icon: Icon, gradient }) => (
							<NavLink
								key={to}
								to={to}
								end={to === "/"}
								tabIndex={open ? 0 : -1}
								className={({ isActive }) =>
									`group flex items-center gap-2.5 whitespace-nowrap rounded-xl px-2 py-1.5 text-sm font-medium transition-all duration-150 ${
										isActive
											? "bg-white/[0.08] text-paper"
											: "text-fog/60 hover:bg-white/[0.05] hover:text-paper"
									}`
								}
							>
								{({ isActive }) => (
									<>
										<span
											className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} text-white transition-opacity ${
												isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"
											}`}
										>
											<Icon className="h-3.5 w-3.5" />
										</span>
										<span className="flex-1">{label}</span>
										{isActive && (
											<span className="h-1.5 w-1.5 rounded-full bg-electric shadow-[0_0_8px_rgba(45,107,255,0.8)]" />
										)}
									</>
								)}
							</NavLink>
						))}
					</div>
				</div>
			)}

			{showPill && (
				<div
					className={`pointer-events-none fixed right-16 z-[9999] flex${isChat ? " landscape-hide" : ""} ${pillPos}`}
				>
					<RunningTimerPill compact={isBoards} />
				</div>
			)}

			{/* Main content */}
			<main className="flex-1 min-h-0 relative h-full">{children}</main>
		</div>
	)
}

// --- Icons ---

function HomeIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
			<polyline points="9 22 9 12 15 12 15 22" />
		</svg>
	)
}

function TasksIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="3" y="3" width="7" height="7" rx="1" />
			<rect x="14" y="3" width="7" height="7" rx="1" />
			<rect x="3" y="14" width="7" height="7" rx="1" />
			<rect x="14" y="14" width="7" height="7" rx="1" />
		</svg>
	)
}

function BoardsIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M12 19l7-7 3 3-7 7-3-3z" />
			<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
			<path d="M2 2l7.586 7.586" />
			<circle cx="11" cy="11" r="2" />
		</svg>
	)
}

function TimeIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 7v5l3 2" />
		</svg>
	)
}

function ChatIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M16 10l4.553-2.276A1 1 0 0122 8.618v6.764a1 1 0 01-1.447.894L16 14v-4z" />
			<rect x="2" y="6" width="14" height="12" rx="2" />
		</svg>
	)
}

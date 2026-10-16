export function cn(...classes: (string | false | null | undefined)[]) {
	return classes.filter(Boolean).join(" ")
}

export const card = "rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl"

export const input =
	"w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-base sm:text-sm text-paper placeholder:text-fog/40 outline-none transition-all focus:border-electric focus:ring-2 focus:ring-electric/20"

export const label = "mb-1.5 block text-xs font-medium text-fog/70"

export const btnPrimary =
	"inline-flex items-center justify-center gap-1.5 rounded-lg bg-electric px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 hover:shadow-glow-electric active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"

export const btnGhost =
	"inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-fog transition-colors hover:bg-white/10 hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"

export const btnDanger =
	"inline-flex items-center justify-center gap-1.5 rounded-lg bg-signal/90 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-signal active:scale-[0.98]"

/** Segmented control container + items (Time tabs, Tasks board/list toggle). */
export const tabBar =
	"flex gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur-xl"

export function tabItem(active: boolean) {
	return cn(
		"flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
		active ? "bg-white/[0.12] text-paper" : "text-fog/50 hover:bg-white/[0.05] hover:text-fog",
	)
}

export const iconBtn =
	"inline-flex h-8 w-8 items-center justify-center rounded-lg text-fog/50 transition-colors hover:bg-white/10 hover:text-paper"

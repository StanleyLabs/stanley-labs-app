/** Inset green outline drawn over a tile while its owner is talking; never affects layout. */
export default function SpeakingRing({ active }: { active: boolean }) {
	return (
		<div
			className={`absolute inset-0 rounded-[inherit] pointer-events-none ring-2 ring-inset ring-green-400 shadow-[inset_0_0_14px_rgba(74,222,128,0.35)] transition-opacity duration-150 ${active ? "opacity-100" : "opacity-0"}`}
		/>
	)
}

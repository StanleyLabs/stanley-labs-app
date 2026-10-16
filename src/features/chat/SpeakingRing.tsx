interface SpeakingRingProps {
	active: boolean
	/** Border width (px) of the rounded-xl parent, so the ring hugs its inner curve. */
	borderWidth: number
}

/** Inset green outline drawn over a tile while its owner is talking; never affects layout. */
export default function SpeakingRing({ active, borderWidth }: SpeakingRingProps) {
	return (
		<div
			className={`absolute inset-0 pointer-events-none ring-2 ring-inset ring-green-400 shadow-[inset_0_0_14px_rgba(74,222,128,0.35)] transition-opacity duration-150 ${active ? "opacity-100" : "opacity-0"}`}
			style={{ borderRadius: `calc(0.75rem - ${borderWidth}px)` }}
		/>
	)
}

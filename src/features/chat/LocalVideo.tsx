import { useEffect, useRef, useState, type RefObject } from "react"
import CameraOffTile from "./CameraOffTile"
import SpeakingRing from "./SpeakingRing"
import { useDraggable } from "./hooks/useDraggable"
import { useSpeaking } from "./hooks/useSpeaking"

interface LocalVideoProps {
	videoRef: RefObject<HTMLVideoElement | null>
	stream: MediaStream | null
	isVideoMuted: boolean
	name?: string
	avatarUrl?: string
}

export default function LocalVideo({
	videoRef,
	stream,
	isVideoMuted,
	name,
	avatarUrl,
}: LocalVideoProps) {
	const pipRef = useRef<HTMLDivElement>(null)
	const speaking = useSpeaking(stream)
	const [isPortrait, setIsPortrait] = useState(false)

	useDraggable(pipRef)

	// Detect portrait vs landscape from actual video dimensions
	useEffect(() => {
		const video = videoRef.current
		if (!video) return

		const checkOrientation = () => {
			const { videoWidth, videoHeight } = video
			if (videoWidth && videoHeight) {
				setIsPortrait(videoHeight > videoWidth)
			}
		}

		video.addEventListener("loadedmetadata", checkOrientation)
		video.addEventListener("resize", checkOrientation)
		checkOrientation()

		return () => {
			video.removeEventListener("loadedmetadata", checkOrientation)
			video.removeEventListener("resize", checkOrientation)
		}
	}, [videoRef])

	return (
		<div
			ref={pipRef}
			className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-10 group landscape-pip ${isPortrait ? "w-24 sm:w-32" : "w-40 sm:w-56"}`}
			style={{ cursor: "grab", touchAction: "none", userSelect: "none" }}
		>
			<div
				className={`relative rounded-xl overflow-hidden border-2 shadow-lg transition-colors duration-150 ${speaking ? "border-green-400 shadow-green-400/20" : "border-electric shadow-electric/10"}`}
			>
				<video
					ref={videoRef}
					autoPlay
					playsInline
					muted
					className="w-full h-full bg-graphite pointer-events-none"
				/>
				{isVideoMuted && <CameraOffTile name={name} avatarUrl={avatarUrl} size="sm" />}
				<SpeakingRing active={speaking} borderWidth={2} />
				<div className="absolute top-2 left-2 px-2 py-0.5 bg-electric/90 backdrop-blur-sm rounded text-[10px] font-semibold text-white pointer-events-none">
					You
				</div>
			</div>
		</div>
	)
}

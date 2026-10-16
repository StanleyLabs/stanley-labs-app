import { useEffect, useState } from "react"

const POLL_MS = 100
const THRESHOLD = 0.02
const HOLD_MS = 400

let sharedCtx: AudioContext | null = null
function getAudioContext(): AudioContext {
	if (!sharedCtx || sharedCtx.state === "closed") sharedCtx = new AudioContext()
	if (sharedCtx.state === "suspended") void sharedCtx.resume().catch(() => {})
	return sharedCtx
}

/** True while the stream's audio track is above a speaking threshold. */
export function useSpeaking(stream: MediaStream | null): boolean {
	const [speaking, setSpeaking] = useState(false)

	useEffect(() => {
		if (!stream) return

		const ctx = getAudioContext()
		const analyser = ctx.createAnalyser()
		analyser.fftSize = 512
		const samples = new Float32Array(analyser.fftSize)

		// Re-bind when the audio track is swapped (device switch mutates the stream in place).
		let boundTrack: MediaStreamTrack | null = null
		let source: MediaStreamAudioSourceNode | null = null
		const bind = () => {
			const track = stream.getAudioTracks()[0] ?? null
			if (track === boundTrack) return
			source?.disconnect()
			source = null
			boundTrack = track
			if (track) {
				source = ctx.createMediaStreamSource(new MediaStream([track]))
				source.connect(analyser)
			}
		}

		let lastLoud = 0
		let current = false
		const tick = () => {
			bind()
			if (!source || !boundTrack?.enabled) {
				lastLoud = 0
			} else {
				analyser.getFloatTimeDomainData(samples)
				let sum = 0
				for (const s of samples) sum += s * s
				if (Math.sqrt(sum / samples.length) > THRESHOLD) lastLoud = performance.now()
			}
			const next = lastLoud > 0 && performance.now() - lastLoud < HOLD_MS
			if (next !== current) {
				current = next
				setSpeaking(next)
			}
		}

		const interval = setInterval(tick, POLL_MS)
		tick()

		return () => {
			clearInterval(interval)
			source?.disconnect()
			analyser.disconnect()
			setSpeaking(false)
		}
	}, [stream])

	return speaking
}

import { useState, useEffect, useCallback } from "react"

interface UseDevicesOptions {
	localStream: MediaStream | null
	onTrackReplaced: (kind: "audio" | "video", track: MediaStreamTrack) => void
}

function getTrack(stream: MediaStream, kind: "audio" | "video"): MediaStreamTrack | undefined {
	return kind === "audio" ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0]
}

export function useDevices({ localStream, onTrackReplaced }: UseDevicesOptions) {
	const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
	const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
	const [selectedAudioDevice, setSelectedAudioDevice] = useState("")
	const [selectedVideoDevice, setSelectedVideoDevice] = useState("")

	const apply = useCallback(
		(devices: MediaDeviceInfo[]) => {
			setAudioDevices(devices.filter((d) => d.kind === "audioinput"))
			setVideoDevices(devices.filter((d) => d.kind === "videoinput"))
			if (!localStream) return
			const audioId = getTrack(localStream, "audio")?.getSettings().deviceId
			const videoId = getTrack(localStream, "video")?.getSettings().deviceId
			if (audioId) setSelectedAudioDevice(audioId)
			if (videoId) setSelectedVideoDevice(videoId)
		},
		[localStream],
	)

	const enumerate = useCallback(async () => {
		try {
			apply(await navigator.mediaDevices.enumerateDevices())
		} catch (err) {
			console.error("Failed to enumerate devices:", err)
		}
	}, [apply])

	// Initial enumeration when stream is available
	useEffect(() => {
		if (!localStream) return
		let cancelled = false
		navigator.mediaDevices
			.enumerateDevices()
			.then((devices) => {
				if (!cancelled) apply(devices)
			})
			.catch((err) => console.error("Failed to enumerate devices:", err))
		return () => {
			cancelled = true
		}
	}, [localStream, apply])

	useEffect(() => {
		const handler = () => enumerate()
		navigator.mediaDevices.addEventListener("devicechange", handler)
		return () => {
			navigator.mediaDevices.removeEventListener("devicechange", handler)
		}
	}, [enumerate])

	const switchDevice = useCallback(
		async (kind: "audio" | "video", deviceId: string) => {
			if (!localStream) return

			try {
				const constraints: MediaStreamConstraints =
					kind === "audio"
						? { audio: { deviceId: { exact: deviceId } } }
						: { video: { deviceId: { exact: deviceId } } }

				const newStream = await navigator.mediaDevices.getUserMedia(constraints)
				const newTrack = getTrack(newStream, kind)
				newStream.getTracks().forEach((t) => {
					if (t !== newTrack) t.stop()
				})
				if (!newTrack) return

				// Swap in place so every holder of localStream sees the new track
				const oldTrack = getTrack(localStream, kind)
				if (oldTrack) {
					newTrack.enabled = oldTrack.enabled
					localStream.removeTrack(oldTrack)
					oldTrack.stop()
				}
				localStream.addTrack(newTrack)

				if (kind === "audio") setSelectedAudioDevice(deviceId)
				else setSelectedVideoDevice(deviceId)

				onTrackReplaced(kind, newTrack)
			} catch (err) {
				console.error(`Failed to switch ${kind} device:`, err)
			}
		},
		[localStream, onTrackReplaced],
	)

	return {
		audioDevices,
		videoDevices,
		selectedAudioDevice,
		selectedVideoDevice,
		enumerate,
		switchDevice,
	}
}

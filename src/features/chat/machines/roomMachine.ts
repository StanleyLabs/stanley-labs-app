import { setup, assign } from "xstate"

/* ---- Types ---- */

export interface PeerMediaState {
	videoMuted: boolean
	avatarUrl?: string
}

interface RoomContext {
	localStream: MediaStream | null
	/** Connected peers in join order; names and media state are looked up by id. */
	peerList: { id: string; stream: MediaStream }[]
	peerNames: Record<string, string>
	peerMedia: Record<string, PeerMediaState>
	spotlightPeerId: string | null
	isAudioMuted: boolean
	isVideoMuted: boolean
	error: string | null
}

export type RoomEvent =
	| { type: "MEDIA_READY"; stream: MediaStream }
	| { type: "MEDIA_ERROR"; error: string }
	| { type: "SOCKET_CONNECTED" }
	| { type: "SOCKET_DISCONNECTED" }
	| { type: "PEER_ADDED"; peerId: string; stream: MediaStream }
	| { type: "PEER_REMOVED"; peerId: string }
	| { type: "PEER_NAME"; peerId: string; name: string }
	| { type: "PEER_MEDIA_STATE"; peerId: string; state: PeerMediaState }
	| { type: "SPOTLIGHT"; peerId: string | null }
	| { type: "TOGGLE_AUDIO" }
	| { type: "TOGGLE_VIDEO" }
	| { type: "LEAVE" }

type EventOf<T extends RoomEvent["type"]> = Extract<RoomEvent, { type: T }>

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
	const { [key]: _removed, ...rest } = record
	void _removed
	return rest
}

/* ---- Machine ---- */

export const roomMachine = setup({
	types: {
		context: {} as RoomContext,
		events: {} as RoomEvent,
	},
	actions: {
		setLocalStream: assign({
			localStream: ({ event }) => (event as EventOf<"MEDIA_READY">).stream,
		}),
		setError: assign({
			error: ({ event }) => (event as EventOf<"MEDIA_ERROR">).error,
		}),
		addPeer: assign({
			peerList: ({ context, event }) => {
				const { peerId, stream } = event as EventOf<"PEER_ADDED">
				if (context.peerList.some((p) => p.id === peerId)) return context.peerList
				return [...context.peerList, { id: peerId, stream }]
			},
		}),
		removePeer: assign(({ context, event }) => {
			const { peerId } = event as EventOf<"PEER_REMOVED">
			return {
				peerList: context.peerList.filter((p) => p.id !== peerId),
				peerNames: omit(context.peerNames, peerId),
				peerMedia: omit(context.peerMedia, peerId),
				spotlightPeerId: context.spotlightPeerId === peerId ? null : context.spotlightPeerId,
			}
		}),
		setPeerName: assign({
			peerNames: ({ context, event }) => {
				const { peerId, name } = event as EventOf<"PEER_NAME">
				return { ...context.peerNames, [peerId]: name }
			},
		}),
		setPeerMediaState: assign({
			peerMedia: ({ context, event }) => {
				const { peerId, state } = event as EventOf<"PEER_MEDIA_STATE">
				return { ...context.peerMedia, [peerId]: state }
			},
		}),
		setSpotlight: assign({
			spotlightPeerId: ({ event }) => (event as EventOf<"SPOTLIGHT">).peerId,
		}),
		toggleAudio: assign({
			isAudioMuted: ({ context }) => {
				const muted = !context.isAudioMuted
				context.localStream?.getAudioTracks().forEach((t) => {
					t.enabled = !muted
				})
				return muted
			},
		}),
		toggleVideo: assign({
			isVideoMuted: ({ context }) => {
				const muted = !context.isVideoMuted
				context.localStream?.getVideoTracks().forEach((t) => {
					t.enabled = !muted
				})
				return muted
			},
		}),
		cleanup: assign({
			localStream: ({ context }) => {
				context.localStream?.getTracks().forEach((t) => t.stop())
				return null
			},
			peerList: () => [],
			peerNames: () => ({}),
			peerMedia: () => ({}),
			spotlightPeerId: () => null,
		}),
	},
}).createMachine({
	id: "room",
	initial: "requestingMedia",
	context: {
		localStream: null,
		peerList: [],
		peerNames: {},
		peerMedia: {},
		spotlightPeerId: null,
		isAudioMuted: false,
		isVideoMuted: false,
		error: null,
	},
	on: {
		LEAVE: {
			target: ".left",
			actions: "cleanup",
		},
	},
	states: {
		requestingMedia: {
			on: {
				MEDIA_READY: {
					target: "connecting",
					actions: "setLocalStream",
				},
				MEDIA_ERROR: {
					target: "error",
					actions: "setError",
				},
			},
		},

		connecting: {
			on: {
				SOCKET_CONNECTED: "connected",
				SOCKET_DISCONNECTED: {
					target: "disconnected",
					actions: "cleanup",
				},
			},
		},

		connected: {
			on: {
				PEER_ADDED: { actions: "addPeer" },
				PEER_REMOVED: { actions: "removePeer" },
				PEER_NAME: { actions: "setPeerName" },
				PEER_MEDIA_STATE: { actions: "setPeerMediaState" },
				SPOTLIGHT: { actions: "setSpotlight" },
				TOGGLE_AUDIO: { actions: "toggleAudio" },
				TOGGLE_VIDEO: { actions: "toggleVideo" },
				SOCKET_DISCONNECTED: {
					target: "disconnected",
					actions: "cleanup",
				},
			},
		},

		disconnected: {
			type: "final",
		},

		error: {
			type: "final",
		},

		left: {
			type: "final",
		},
	},
})

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

function getIceServers(): RTCIceServer[] {
  const raw = import.meta.env.VITE_ICE_SERVERS_JSON
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as RTCIceServer[]
    } catch {
      console.warn('[webrtc] VITE_ICE_SERVERS_JSON is not valid JSON; using defaults')
    }
  }
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
}

interface UseWebRTCOptions {
  roomId: string
  localStream: MediaStream | null
  onConnected: () => void
  onDisconnected: () => void
  onPeerAdded: (peerId: string, stream: MediaStream) => void
  onPeerRemoved: (peerId: string) => void
  onPeerName: (peerId: string, name: string) => void
}

export function useWebRTC({
  roomId,
  localStream,
  onConnected,
  onDisconnected,
  onPeerAdded,
  onPeerRemoved,
  onPeerName,
}: UseWebRTCOptions) {
  const socketRef = useRef<Socket | null>(null)
  const peersRef = useRef<Record<string, RTCPeerConnection>>({})
  const pendingIceRef = useRef<Record<string, RTCIceCandidateInit[]>>({})

  const getSocket = useCallback(() => socketRef.current, [])

  // Replace tracks in all peer connections (for device switching)
  const replaceTrackInPeers = useCallback(async (kind: 'audio' | 'video', newTrack: MediaStreamTrack) => {
    for (const pc of Object.values(peersRef.current)) {
      const sender = pc.getSenders().find(s => s.track?.kind === kind)
      if (sender) await sender.replaceTrack(newTrack)
    }
  }, [])

  useEffect(() => {
    if (!localStream) return

    const iceServers = getIceServers()
    const serverUrl = import.meta.env.VITE_SIGNALING_SERVER_URL || undefined
    const socket = io(serverUrl)
    socketRef.current = socket

    const flushPendingIce = async (peerId: string, peer: RTCPeerConnection) => {
      const pending = pendingIceRef.current[peerId]
      if (!pending?.length) return
      pendingIceRef.current[peerId] = []
      for (const init of pending) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(init))
        } catch (err) {
          console.warn('[webrtc] addIceCandidate (queued)', err)
        }
      }
    }

    const enqueueOrAddIce = (peerId: string, init: RTCIceCandidateInit) => {
      const peer = peersRef.current[peerId]
      if (!peer) return
      if (!peer.remoteDescription) {
        if (!pendingIceRef.current[peerId]) pendingIceRef.current[peerId] = []
        pendingIceRef.current[peerId].push(init)
        return
      }
      peer.addIceCandidate(new RTCIceCandidate(init)).catch(err => {
        console.warn('[webrtc] addIceCandidate', err)
      })
    }

    socket.on('connect', () => {
      onConnected()
      socket.emit('join', { channel: roomId, userdata: { name: '' } })
    })

    socket.on('disconnect', () => {
      onDisconnected()
    })

    socket.on('addPeer', async (config: { peer_id: string; should_create_offer: boolean }) => {
      const peerId = config.peer_id
      if (peersRef.current[peerId]) return

      pendingIceRef.current[peerId] = []
      const pc = new RTCPeerConnection({ iceServers })
      peersRef.current[peerId] = pc

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('relayICECandidate', {
            peer_id: peerId,
            ice_candidate: {
              sdpMLineIndex: e.candidate.sdpMLineIndex,
              sdpMid: e.candidate.sdpMid ?? undefined,
              candidate: e.candidate.candidate,
            },
          })
        }
      }

      pc.ontrack = (e) => {
        if (e.track.kind === 'audio') return
        onPeerAdded(peerId, e.streams[0])
      }

      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream)
      })

      if (config.should_create_offer) {
        try {
          const desc = await pc.createOffer()
          await pc.setLocalDescription(desc)
          socket.emit('relaySessionDescription', {
            peer_id: peerId,
            session_description: desc,
          })
        } catch (err) {
          console.error('Error creating offer:', err)
        }
      }
    })

    socket.on('sessionDescription', async (config: {
      peer_id: string
      session_description: RTCSessionDescriptionInit
    }) => {
      const peerId = config.peer_id
      const peer = peersRef.current[peerId]
      if (!peer) return

      try {
        await peer.setRemoteDescription(new RTCSessionDescription(config.session_description))
        await flushPendingIce(peerId, peer)
        if (config.session_description.type === 'offer') {
          const desc = await peer.createAnswer()
          await peer.setLocalDescription(desc)
          socket.emit('relaySessionDescription', {
            peer_id: peerId,
            session_description: desc,
          })
        }
      } catch (err) {
        console.error('setRemoteDescription error:', err)
      }
    })

    socket.on('iceCandidate', (config: { peer_id: string; ice_candidate: RTCIceCandidateInit }) => {
      enqueueOrAddIce(config.peer_id, config.ice_candidate)
    })

    socket.on('removePeer', (config: { peer_id: string }) => {
      const peerId = config.peer_id
      if (peersRef.current[peerId]) {
        peersRef.current[peerId].close()
        delete peersRef.current[peerId]
      }
      delete pendingIceRef.current[peerId]
      onPeerRemoved(peerId)
    })

    socket.on('peerName', (config: { peer_id: string; name: string }) => {
      onPeerName(config.peer_id, config.name)
    })

    return () => {
      Object.values(peersRef.current).forEach(pc => pc.close())
      peersRef.current = {}
      pendingIceRef.current = {}
      socket.disconnect()
      socketRef.current = null
    }
  }, [roomId, localStream, onConnected, onDisconnected, onPeerAdded, onPeerRemoved, onPeerName])

  const sendName = useCallback((name: string) => {
    socketRef.current?.emit('relayName', { name })
  }, [])

  return { getSocket, replaceTrackInPeers, sendName }
}

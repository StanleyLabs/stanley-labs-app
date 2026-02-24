import { useEffect, useRef, useState } from 'react'
import JoinForm from './JoinForm'
import VideoChat from './VideoChat'

function ChatApp() {
  const [roomId, setRoomId] = useState<string | null>(null)
  const activeStreamRef = useRef<MediaStream | null>(null)

  const handleJoinRoom = (room: string) => {
    setRoomId(room)
  }

  const handleLeaveRoom = () => {
    setRoomId(null)
  }

  // Safety net: stop all media tracks when ChatApp unmounts (navigating away)
  useEffect(() => {
    return () => {
      activeStreamRef.current?.getTracks().forEach(t => t.stop())
      activeStreamRef.current = null
    }
  }, [])

  return (
    <div className="h-full flex flex-col bg-ink grain overflow-hidden">
      <main className="flex-1 min-h-0">
        {!roomId ? (
          <JoinForm onJoin={handleJoinRoom} />
        ) : (
          <VideoChat roomId={roomId} onLeave={handleLeaveRoom} streamRef={activeStreamRef} />
        )}
      </main>
    </div>
  )
}

export default ChatApp

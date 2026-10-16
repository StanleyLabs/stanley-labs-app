import { useState } from "react"
import JoinForm from "./JoinForm"
import VideoChat from "./VideoChat"

function ChatApp() {
	const [roomId, setRoomId] = useState<string | null>(null)

	return (
		<div className="h-full flex flex-col bg-ink grain overflow-hidden">
			<main className="flex-1 min-h-0">
				{!roomId ? (
					<JoinForm onJoin={setRoomId} />
				) : (
					<VideoChat roomId={roomId} onLeave={() => setRoomId(null)} />
				)}
			</main>
		</div>
	)
}

export default ChatApp

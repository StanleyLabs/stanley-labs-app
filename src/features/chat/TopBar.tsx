export default function TopBar({ roomId, isConnected, peerCount, displayName, savedName, onNameChange, onNameEdit, onNameSave }: {
    roomId: string
    isConnected: boolean
    peerCount: number
    displayName: string
    savedName: string
    onNameChange: (name: string) => void
    onNameEdit: () => void
    onNameSave: () => void
  }) {
    return (
      <div className="shrink-0 border-b border-white/10 bg-graphite/50 backdrop-blur-sm landscape-hide">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="hidden sm:block text-sm sm:text-lg font-display font-semibold text-paper truncate">
              Room: <span className="text-electric font-mono">{roomId}</span>
            </h2>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full shrink-0">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-xs font-mono text-fog whitespace-nowrap">
                {isConnected ? 'Connected' : 'Connecting...'}
              </span>
            </div>
            <span className="sm:hidden w-2 h-2 rounded-full shrink-0" style={{ background: isConnected ? '#22c55e' : '#6b7280' }} />
            {peerCount > 0 && (
              <div className="text-xs font-mono text-fog whitespace-nowrap shrink-0">
                {peerCount} {peerCount === 1 ? 'peer' : 'peers'}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {savedName ? (
              <button
                onClick={onNameEdit}
                title="Change name"
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-paper transition-all hover:bg-white/10"
              >
                <span className="font-medium truncate max-w-[8rem]">{savedName}</span>
                <svg className="w-3 h-3 text-fog/60 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
                </svg>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => onNameChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onNameSave() }}
                  placeholder="Your name"
                  maxLength={24}
                  className="w-28 sm:w-32 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-base text-paper placeholder:text-fog/40 outline-none focus:border-electric focus:ring-1 focus:ring-electric/20 transition-all"
                />
                <button
                  onClick={onNameSave}
                  title="Set name"
                  className="shrink-0 px-3 py-1.5 bg-electric/10 border border-electric/30 text-electric text-base font-medium rounded-lg transition-all hover:bg-electric/20 active:scale-[0.95]"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }
  
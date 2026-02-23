import { type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";

const navItems = [
  { to: "/tasks", label: "Tasks", icon: TasksIcon },
  { to: "/boards", label: "Boards", icon: BoardsIcon },
  { to: "/chat", label: "Chat", icon: ChatIcon },
];

export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const isChat = pathname.startsWith("/chat");

  return (
    <div className="flex h-full flex-col bg-ink">
      {/* Top navigation bar - hidden in mobile landscape on chat */}
      <nav className={`shrink-0 border-b border-white/[0.06] bg-ink/80 backdrop-blur-xl z-50${isChat ? " landscape-hide" : ""}`}>
          <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-center px-4 sm:px-6">
            {/* Logo */}
            <NavLink
              to="/"
              className="mr-8 flex items-center gap-2.5 text-paper transition-opacity hover:opacity-80"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-electric/10">
                <svg
                  className="h-4 w-4 text-electric"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="font-display text-sm font-semibold tracking-tight">
                Stanley Labs
              </span>
            </NavLink>

            {/* Nav links */}
            <div className="flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      isActive
                        ? "bg-white/[0.08] text-paper"
                        : "text-fog/60 hover:bg-white/[0.04] hover:text-fog"
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

      {/* Main content */}
      <main className="flex-1 min-h-0 relative">
        {children}
      </main>
    </div>
  );
}

// --- Icons ---

function TasksIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function BoardsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" />
      <rect x="1" y="6" width="14" height="12" rx="2" />
    </svg>
  );
}

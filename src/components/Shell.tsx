import { type ReactNode, useState, useRef, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";

const navItems = [
  { to: "/", label: "Home", icon: HomeIcon },
  { to: "/tasks", label: "Tasks", icon: TasksIcon },
  { to: "/boards", label: "Boards", icon: BoardsIcon },
  { to: "/chat", label: "Chat", icon: ChatIcon },
];

export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const isChat = pathname.startsWith("/chat");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-full flex-col bg-ink">
      {/* Floating nav */}
      {!isHome && (
        <div
          ref={containerRef}
          className={`fixed left-4 top-4 z-[9999]${isChat ? " landscape-hide" : ""}`}
        >
          <div
            className={`flex items-center gap-1 rounded-full border border-white/[0.08] bg-ink/90 backdrop-blur-xl shadow-lg transition-all duration-300 ease-out ${
              open ? "px-2 py-1.5" : "px-0 py-0"
            }`}
          >
            {/* Main toggle button (Stanley Labs logo) */}
            <button
              onClick={() => setOpen((v) => !v)}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                open
                  ? "bg-white/[0.08] text-paper"
                  : "text-fog/60 hover:text-paper"
              }`}
              title="Stanley Labs"
            >
              <svg
                className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-90" : ""}`}
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
            </button>

            {/* Expandable nav items */}
            <div
              className={`flex items-center gap-1 overflow-hidden transition-all duration-300 ease-out ${
                open ? "max-w-[400px] opacity-100" : "max-w-0 opacity-0"
              }`}
            >
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-white/[0.1] text-paper"
                        : "text-fog/50 hover:bg-white/[0.05] hover:text-fog"
                    }`
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-h-0 relative h-full">
        {children}
      </main>
    </div>
  );
}

// --- Icons ---

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

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

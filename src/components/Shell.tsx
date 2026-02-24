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
  const isLogin = pathname === "/login";
  const isChat = pathname.startsWith("/chat");
  const isBoards = pathname.startsWith("/boards");
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
      {/* Floating nav - centered at top */}
      {!isHome && !isLogin && (
        <div
          ref={containerRef}
          className={`fixed right-4 z-[9999] flex items-end${isChat ? " landscape-hide" : ""} ${
            isBoards
              ? "top-4 flex-col sm:top-auto sm:bottom-12 sm:flex-col-reverse"
              : "bottom-4 flex-col-reverse"
          }`}
        >
          {/* Main toggle button */}
          <button
            onClick={() => setOpen((v) => !v)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-ink/90 backdrop-blur-xl shadow-lg transition-all duration-200 ${
              open
                ? "bg-white/[0.12] text-paper"
                : "text-fog/60 hover:text-paper hover:bg-ink"
            }`}
            title="Stanley Labs"
          >
            <svg
              className="h-[18px] w-[18px]"
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

          {/* Dropdown pill below */}
          <div
            className={`flex flex-col items-stretch rounded-2xl border border-white/[0.08] bg-ink/90 backdrop-blur-xl shadow-lg overflow-hidden transition-all duration-300 ease-out ${
              isBoards ? "mt-2 origin-top sm:mt-0 sm:mb-2 sm:origin-bottom" : "mb-2 origin-bottom"
            } ${
              open
                ? "max-h-[300px] opacity-100 scale-y-100 py-1.5 px-1.5"
                : "max-h-0 opacity-0 scale-y-90 py-0 px-0"
            }`}
          >
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-white/[0.1] text-paper"
                      : "text-fog/50 hover:bg-white/[0.05] hover:text-fog"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            ))}

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


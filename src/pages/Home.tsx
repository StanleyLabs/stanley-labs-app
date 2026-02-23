import { Link } from "react-router-dom";

const apps = [
  {
    to: "/tasks",
    title: "Project Dashboard",
    description: "Kanban boards, task management, and project organization.",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    color: "from-accent to-accent-light",
    borderColor: "border-accent/20 hover:border-accent/40",
  },
  {
    to: "/boards",
    title: "Whiteboard",
    description: "Infinite canvas for sketching, diagramming, and collaboration.",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
      </svg>
    ),
    color: "from-emerald-500 to-teal-400",
    borderColor: "border-emerald-500/20 hover:border-emerald-500/40",
  },
  {
    to: "/chat",
    title: "Video Chat",
    description: "Real-time group video calls with WebRTC.",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" />
        <rect x="1" y="6" width="14" height="12" rx="2" />
      </svg>
    ),
    color: "from-electric to-blue-400",
    borderColor: "border-electric/20 hover:border-electric/40",
  },
];

export default function Home() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="mb-10 text-center">
          <h1 className="font-display text-3xl font-bold text-paper sm:text-4xl">
            Stanley Labs
          </h1>
          <p className="mt-3 text-fog/60">
            Your workspace. Pick a tool to get started.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {apps.map(({ to, title, description, icon, color, borderColor }) => (
            <Link
              key={to}
              to={to}
              className={`group relative flex flex-col rounded-xl border bg-graphite/50 p-6 transition-all hover:bg-graphite ${borderColor}`}
            >
              <div
                className={`mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${color} text-white shadow-lg`}
              >
                {icon}
              </div>
              <h2 className="font-display text-base font-semibold text-paper">
                {title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-fog/50">
                {description}
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-medium text-fog/40 group-hover:text-fog/60 transition-colors">
                Open
                <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

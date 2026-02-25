import { Link } from "react-router-dom";

export default function Privacy() {
  return (
    <div className="h-full bg-ink text-paper">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="mb-6">
          <Link to="/" className="text-sm text-fog/60 hover:text-paper">Back</Link>
        </div>

        <h1 className="font-display text-2xl font-semibold">Privacy</h1>

        <p className="mt-4 text-sm leading-relaxed text-fog/80">
          This app uses essential storage for functionality (for example, authentication/session state).
          We do not use advertising trackers.
        </p>

        <p className="mt-4 text-sm leading-relaxed text-fog/80">
          Video chat uses WebRTC to connect peers. Media streams are processed in your browser and sent directly to
          other participants.
        </p>

        <p className="mt-8 text-xs text-fog/60">Last updated: 2026-02-24</p>
      </div>
    </div>
  );
}

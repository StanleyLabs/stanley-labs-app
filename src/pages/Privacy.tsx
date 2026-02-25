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
          This app uses essential storage for functionality (for example, keeping your session and settings working).
        </p>

        <p className="mt-4 text-sm leading-relaxed text-fog/80">
          Stanley Labs App can run in two modes: signed in (cloud sync) or offline (saved in your browser).
        </p>

        <p className="mt-4 text-sm leading-relaxed text-fog/80">
          If you sign in, we use Supabase (database and authentication) to store and sync your data across devices.
          If you do not sign in, your data stays in your browser's local storage.
        </p>

        <p className="mt-4 text-sm leading-relaxed text-fog/80">
          Want full control? You can export your data to JSON and import it later.
        </p>

        <p className="mt-4 text-sm leading-relaxed text-fog/80">
          No ads, no marketing trackers.
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

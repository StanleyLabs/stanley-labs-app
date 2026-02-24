import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import {
  SNAPSHOT_KEY,
  getCloudPageIds,
  clearCloudPageIds,
} from "../features/boards/persistence";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  signInWithEmail: async () => ({ error: null }),
  signUpWithEmail: async () => ({ error: null }),
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const signInWithApple = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = async () => {
    // Remove only cloud-loaded pages from the whiteboard localStorage snapshot
    try {
      const cloudPageIds = getCloudPageIds();
      if (cloudPageIds.length > 0) {
        const raw = localStorage.getItem(SNAPSHOT_KEY);
        if (raw) {
          const snapshot = JSON.parse(raw);
          const store = snapshot?.document?.store;
          if (store && typeof store === 'object') {
            // Remove cloud page records and all records belonging to those pages
            for (const [key, value] of Object.entries(store)) {
              const rec = value as { typeName?: string; id?: string; pageId?: string };
              // Remove the page record itself
              if (rec.typeName === 'page' && rec.id && cloudPageIds.includes(rec.id)) {
                delete store[key];
              }
              // Remove shapes, bindings, etc. on cloud pages
              if (rec.pageId && cloudPageIds.includes(rec.pageId)) {
                delete store[key];
              }
            }

            // Also clean up session page states for removed pages
            const session = snapshot?.session;
            if (session?.pageStates) {
              session.pageStates = session.pageStates.filter(
                (ps: { pageId?: string }) => !ps.pageId || !cloudPageIds.includes(ps.pageId)
              );
            }

            localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
          }
        }
      }
      clearCloudPageIds();
    } catch { /* ignore errors - don't block sign out */ }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInWithApple,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

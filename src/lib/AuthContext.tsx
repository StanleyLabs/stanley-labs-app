import { useEffect, useState, type ReactNode } from "react";
import type { RecordModel } from "pocketbase";
import { AuthContext, type AppUser } from "./auth";
import { errorMessage, pb } from "./pocketbase";

function toAppUser(record: RecordModel | null): AppUser | null {
  if (!record?.id) return null;
  const avatarFile = record.avatar ? pb.files.getURL(record, record.avatar) : "";
  return {
    id: record.id,
    email: record.email ?? "",
    name: record.name || undefined,
    avatarUrl: record.avatar_url || avatarFile || undefined,
  };
}

function currentUser(): AppUser | null {
  return pb.authStore.isValid ? toAppUser(pb.authStore.record) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange(() => setUser(currentUser()));

    if (pb.authStore.isValid) {
      pb.collection("users")
        .authRefresh()
        .catch(() => pb.authStore.clear())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    return () => unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await pb.collection("users").authWithPassword(email, password);
      return { error: null };
    } catch (err) {
      return { error: errorMessage(err) };
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      await pb.collection("users").create({ email, password, passwordConfirm: password });
      void pb.collection("users").requestVerification(email).catch(() => {});
      await pb.collection("users").authWithPassword(email, password);
      return { error: null };
    } catch (err) {
      return { error: errorMessage(err) };
    }
  };

  const signInWithOAuth = async (provider: "google" | "apple") => {
    try {
      const auth = await pb.collection("users").authWithOAuth2({ provider });
      const meta = auth.meta ?? {};
      const patch: Record<string, string> = {};
      if (meta.avatarURL && !auth.record.avatar_url) patch.avatar_url = meta.avatarURL;
      if (meta.name && !auth.record.name) patch.name = meta.name;
      if (Object.keys(patch).length) {
        await pb.collection("users").update(auth.record.id, patch);
        await pb.collection("users").authRefresh();
      }
    } catch (err) {
      console.warn(`[auth] ${provider} sign-in failed:`, errorMessage(err));
    }
  };

  const signInWithGoogle = () => signInWithOAuth("google");
  const signInWithApple = () => signInWithOAuth("apple");

  const signOut = async () => {
    pb.realtime.unsubscribe().catch(() => {});
    pb.authStore.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
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

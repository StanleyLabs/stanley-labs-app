import { createContext, useContext } from "react"

export interface AppUser {
	id: string
	email: string
	name?: string
	/** Name shown in video chat; falls back to `name` when unset. */
	chatName?: string
	avatarUrl?: string
}

interface AuthState {
	user: AppUser | null
	loading: boolean
	signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
	signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
	signInWithGoogle: () => Promise<void>
	signInWithApple: () => Promise<void>
	signOut: () => Promise<void>
	/** `avatar: null` removes the current photo (uploaded or from the OAuth provider). */
	updateProfile: (patch: ProfilePatch) => Promise<{ error: string | null }>
}

export interface ProfilePatch {
	name?: string
	avatar?: File | null
}

export const AuthContext = createContext<AuthState>({
	user: null,
	loading: true,
	signInWithEmail: async () => ({ error: null }),
	signUpWithEmail: async () => ({ error: null }),
	signInWithGoogle: async () => {},
	signInWithApple: async () => {},
	signOut: async () => {},
	updateProfile: async () => ({ error: null }),
})

export function initialsFor(user: Pick<AppUser, "name" | "email">): string {
	const parts = (user.name ?? "").trim().split(/\s+/).filter(Boolean)
	if (parts.length === 0) return (user.email?.[0] ?? "?").toUpperCase()
	if (parts.length === 1) return parts[0][0].toUpperCase()
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function useAuth() {
	return useContext(AuthContext)
}

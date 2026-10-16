import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { initialsFor, useAuth, type AppUser } from "../lib/auth"
import { Modal } from "./ui/Modal"
import { btnGhost, btnPrimary, input, label } from "./ui/styles"

const AVATAR_SIZE = 256

/** Center-crops and downscales an image to a small square avatar. */
async function toAvatarFile(file: File): Promise<File> {
	const url = URL.createObjectURL(file)
	try {
		const img = new Image()
		img.src = url
		await img.decode()
		const side = Math.min(img.naturalWidth, img.naturalHeight)
		const size = Math.min(AVATAR_SIZE, side)
		const canvas = document.createElement("canvas")
		canvas.width = size
		canvas.height = size
		const ctx = canvas.getContext("2d")
		if (!ctx) return file
		ctx.drawImage(
			img,
			(img.naturalWidth - side) / 2,
			(img.naturalHeight - side) / 2,
			side,
			side,
			0,
			0,
			size,
			size,
		)
		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, "image/webp", 0.9),
		)
		if (!blob) return file
		const ext = blob.type === "image/webp" ? "webp" : "png"
		return new File([blob], `avatar.${ext}`, { type: blob.type })
	} finally {
		URL.revokeObjectURL(url)
	}
}

export function ProfileDialog({ user, onClose }: { user: AppUser; onClose: () => void }) {
	const { updateProfile } = useAuth()
	const [name, setName] = useState(user.name ?? "")
	// undefined = unchanged, null = remove, File = replace
	const [avatar, setAvatar] = useState<File | null | undefined>(undefined)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const fileRef = useRef<HTMLInputElement>(null)

	const pendingUrl = useMemo(() => (avatar ? URL.createObjectURL(avatar) : null), [avatar])
	useEffect(() => {
		if (!pendingUrl) return
		return () => URL.revokeObjectURL(pendingUrl)
	}, [pendingUrl])

	const previewUrl = avatar === undefined ? user.avatarUrl : pendingUrl
	const nameChanged = name.trim() !== (user.name ?? "")
	const dirty = nameChanged || avatar !== undefined

	async function handleFile(file: File | undefined) {
		if (!file) return
		setError(null)
		if (!file.type.startsWith("image/")) {
			setError("Please choose an image file.")
			return
		}
		try {
			setAvatar(await toAvatarFile(file))
		} catch {
			setError("Couldn't read that image.")
		}
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		if (!dirty || saving) return
		setSaving(true)
		setError(null)
		const result = await updateProfile({
			...(nameChanged ? { name } : {}),
			...(avatar !== undefined ? { avatar } : {}),
		})
		setSaving(false)
		if (result.error) setError(result.error)
		else onClose()
	}

	return (
		<Modal open title="Profile" onClose={onClose} width="max-w-sm">
			<form onSubmit={handleSubmit} className="flex flex-col gap-5">
				<div className="flex items-center gap-4">
					<div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-electric/20 text-2xl font-semibold text-blue-100 ring-2 ring-white/10">
						{previewUrl ? (
							<img
								src={previewUrl}
								alt=""
								referrerPolicy="no-referrer"
								className="h-full w-full object-cover"
							/>
						) : (
							initialsFor({ name: name || user.name, email: user.email })
						)}
					</div>
					<div className="flex flex-col items-start gap-2">
						<button type="button" className={btnGhost} onClick={() => fileRef.current?.click()}>
							Change photo
						</button>
						{previewUrl && (
							<button
								type="button"
								className="text-xs font-medium text-fog/50 transition-colors hover:text-paper"
								onClick={() => setAvatar(null)}
							>
								Remove photo
							</button>
						)}
						<input
							ref={fileRef}
							type="file"
							accept="image/*"
							className="hidden"
							onChange={(e) => {
								void handleFile(e.target.files?.[0])
								e.target.value = ""
							}}
						/>
					</div>
				</div>

				<div>
					<label htmlFor="profile-name" className={label}>
						Name
					</label>
					<input
						id="profile-name"
						className={input}
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Your name"
						maxLength={255}
						autoComplete="name"
					/>
				</div>

				<div>
					<span className={label}>Email</span>
					<p className="truncate text-sm text-fog/60">{user.email}</p>
				</div>

				{error && <p className="text-sm text-signal">{error}</p>}

				<div className="flex justify-end gap-2">
					<button type="button" className={btnGhost} onClick={onClose}>
						Cancel
					</button>
					<button type="submit" className={btnPrimary} disabled={!dirty || saving}>
						{saving ? "Saving..." : "Save"}
					</button>
				</div>
			</form>
		</Modal>
	)
}

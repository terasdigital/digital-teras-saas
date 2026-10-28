import { z } from 'zod'

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Nama minimal 2 karakter'),
  email: z.email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
})

export const loginSchema = z.object({
  email: z.email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>

/** Hasil standar aksi form auth untuk useActionState. */
export type AuthResult = {
  error?: string
  /** Pesan sukses non-redirect, mis. "cek inbox untuk konfirmasi email". */
  notice?: string
} | null

/** Ambil pesan user-friendly dari Zod SafeParseError. */
export function zodMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Data tidak valid'
}

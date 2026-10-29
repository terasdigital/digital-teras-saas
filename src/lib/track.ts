import type { TrackType } from '@/lib/validation/track'

export type { TrackType }

/**
 * Session-id per tab (bukan cookie persisten) — mengaitkan visit → order
 * tanpa menyimpan data pribadi. Menghormati mode privat: bila sessionStorage
 * ditolak, event tetap jalan tanpa sid.
 */
export function getSessionId(): string | null {
  try {
    let sid = sessionStorage.getItem('dt.sid')
    if (!sid) {
      sid = crypto.randomUUID()
      sessionStorage.setItem('dt.sid', sid)
    }
    return sid
  } catch {
    return null
  }
}

// Guard klien terhadap double-mount StrictMode (dev): satu halaman event
// per 30 dtk per jenis+target+path. Otoritas tetap di server (log_event);
// ini hanya menghemat request beacon.
const recentViews = new Set<string>()

export function dedupeView(type: TrackType, targetId?: string | null): string | null {
  if (type !== 'visit' && type !== 'product_view') return null
  const key = `${type}|${targetId ?? ''}|${typeof window !== 'undefined' ? window.location.pathname : ''}`
  if (recentViews.has(key)) return key
  recentViews.add(key)
  setTimeout(() => recentViews.delete(key), 30_000)
  return null
}

/**
 * Kirim event analitik via sendBeacon (api ini tidak pernah melempar
 * ke halaman: kegagalan tracking harus senyap).
 */
export function track(
  storeSlug: string,
  type: TrackType,
  targetId?: string | null,
): void {
  if (dedupeView(type, targetId)) return
  const payload = JSON.stringify({
    slug: storeSlug,
    type,
    target: targetId ?? null,
    sid: getSessionId(),
    path: typeof window !== 'undefined' ? window.location.pathname : null,
  })
  try {
    const body = new Blob([payload], { type: 'application/json' })
    const sent = navigator.sendBeacon?.('/api/track', body)
    if (!sent) {
      void fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => undefined)
    }
  } catch {
    /* analitik tidak boleh mengganggu halaman */
  }
}

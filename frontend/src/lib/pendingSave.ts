import type { GraphJson } from './projects'

const KEY = 'sysflow_pending_save'

interface PendingSave {
  name: string
  graphJson: GraphJson
}

/**
 * Stashes the in-progress graph before redirecting an unauthenticated user
 * to /login so a "Save" click never silently loses their canvas — the
 * editor restores this on the next mount, wherever the user lands.
 */
export function stashPendingSave(name: string, graphJson: GraphJson) {
  sessionStorage.setItem(KEY, JSON.stringify({ name, graphJson }))
}

export function takePendingSave(): PendingSave | null {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  sessionStorage.removeItem(KEY)
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

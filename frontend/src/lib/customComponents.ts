import type { ComponentCategory, ComponentDef } from '../components/nodes'

const STORAGE_KEY = 'sysflow:custom-components'

export interface CustomComponentDef {
  type: string
  label: string
  category: ComponentCategory
  description: string
  icon: string
  defaultConfig: Record<string, unknown>
}

function load(): CustomComponentDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function save(defs: CustomComponentDef[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(defs)) } catch { /* full */ }
}

export function getCustomComponents(): CustomComponentDef[] {
  return load()
}

export function toComponentDef(c: CustomComponentDef): ComponentDef {
  return {
    type: c.type as ComponentDef['type'],
    label: c.label,
    category: c.category,
    description: c.description,
    examples: `Custom · ${c.icon}`,
    defaultConfig: c.defaultConfig,
  }
}

export function saveCustomComponent(def: CustomComponentDef): void {
  const all = load()
  const idx = all.findIndex((c) => c.type === def.type)
  if (idx >= 0) all[idx] = def; else all.push(def)
  save(all)
}

export function deleteCustomComponent(type: string): void {
  save(load().filter((c) => c.type !== type))
}

export function exportCustomComponents(): string {
  return JSON.stringify(load(), null, 2)
}

export function importCustomComponents(json: string): CustomComponentDef[] {
  const parsed = JSON.parse(json)
  if (!Array.isArray(parsed)) throw new Error('Expected an array')
  const validated = parsed.filter((c) => c.type && c.label && c.category)
  const all = load()
  for (const c of validated) {
    const idx = all.findIndex((x) => x.type === c.type)
    if (idx >= 0) all[idx] = c; else all.push(c)
  }
  save(all)
  return all
}

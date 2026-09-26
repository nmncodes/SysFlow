import { COMPONENT_LIBRARY, type ComponentCategory, type ComponentType } from '../components/nodes'

/**
 * Centralised architecture knowledge used by graphValidation.ts.
 * To teach the validator something new, edit the tables below — the engine
 * itself should not need to change.
 *
 * Edges are directed and mean "traffic / data flows from source to target",
 * which matches how the simulation engine interprets them.
 */

export type TypeSet = ReadonlySet<ComponentType>

const typeSet = (...types: ComponentType[]): TypeSet => new Set(types)

const typesInCategory = (category: ComponentCategory): TypeSet =>
  new Set(COMPONENT_LIBRARY.filter((c) => c.category === category).map((c) => c.type))

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/** Everything the palette files under "Client" (mirrors CLIENT_TYPES in the backend RuleEngine). */
export const CLIENT_TYPES: TypeSet = typesInCategory('Client')

/** Components that originate work without an upstream caller. */
export const TRIGGER_TYPES: TypeSet = typeSet('cronJob', 'webhook')

/** Roots for reachability: traffic starts at a client or is self/externally triggered. */
export const ENTRY_TYPES: TypeSet = new Set([...CLIENT_TYPES, ...TRIGGER_TYPES])

// ---------------------------------------------------------------------------
// Connection compatibility (deny-list)
// ---------------------------------------------------------------------------

/** Data components a client should never query directly. */
const QUERYABLE_STORES = typeSet('database', 'dataWarehouse', 'searchIndex', 'dataLake', 'cache')

/** Stores/brokers that are reachable from clients only in specific, credentialed patterns. */
const DIRECT_ACCESS_SENSITIVE = typeSet('objectStorage', 'messageBroker')

export interface ConnectionRule {
  id: string
  severity: 'error' | 'warning'
  matches: (source: ComponentType, target: ComponentType) => boolean
  /** Receives display names of the source and target components. */
  message: (source: string, target: string) => string
}

/**
 * Suspicious source → target pairs. The first matching rule wins per edge, so
 * order more specific rules first. Rules 1–3 mirror the checks the backend
 * RuleEngine already makes; the last one follows from clients being entry points.
 */
export const CONNECTION_RULES: readonly ConnectionRule[] = [
  {
    id: 'client-to-payment-gateway',
    severity: 'error',
    matches: (s, t) => CLIENT_TYPES.has(s) && t === 'paymentGateway',
    message: (s, t) =>
      `${s} calls ${t} directly. Payment providers should be called from a backend Service, never from client code.`,
  },
  {
    id: 'client-to-data-store',
    severity: 'error',
    matches: (s, t) => CLIENT_TYPES.has(s) && QUERYABLE_STORES.has(t),
    message: (s, t) =>
      `${s} connects directly to ${t}, bypassing the service layer. Route it through a Service or API Gateway.`,
  },
  {
    id: 'client-to-storage-or-broker',
    severity: 'warning',
    matches: (s, t) => CLIENT_TYPES.has(s) && DIRECT_ACCESS_SENSITIVE.has(t),
    message: (s, t) =>
      `${s} connects directly to ${t}. That is only reasonable with scoped credentials (e.g. signed URLs) or a device-facing broker; otherwise route it through a Service or API Gateway.`,
  },
  {
    id: 'into-client',
    severity: 'warning',
    matches: (_s, t) => CLIENT_TYPES.has(t),
    message: (s, t) =>
      `${s} connects into ${t}. Clients are traffic entry points and normally have no incoming connections.`,
  },
]

// ---------------------------------------------------------------------------
// Missing connections
// ---------------------------------------------------------------------------

export interface DownstreamRule {
  id: string
  types: TypeSet
  /** Receives the display name of the offending component. */
  message: (name: string) => string
}

/** Component types that only make sense if something sits downstream of them. */
export const DOWNSTREAM_REQUIREMENTS: readonly DownstreamRule[] = [
  {
    id: 'client-needs-target',
    types: CLIENT_TYPES,
    message: (n) => `${n} has no outgoing connection, so its requests go nowhere.`,
  },
  {
    id: 'forwarder-needs-target',
    types: typeSet('dns', 'cdn', 'loadBalancer', 'apiGateway', 'waf', 'ingress'),
    message: (n) => `${n} forwards traffic but has no downstream component to forward it to.`,
  },
  {
    id: 'buffer-needs-consumer',
    types: typeSet('queue', 'messageBroker', 'eventBus'),
    message: (n) => `${n} has no downstream consumer, so messages will accumulate unprocessed.`,
  },
  {
    id: 'trigger-needs-target',
    types: typeSet('cronJob', 'webhook'),
    message: (n) => `${n} has no downstream component, so it triggers no work.`,
  },
]

// ---------------------------------------------------------------------------
// Known types
// ---------------------------------------------------------------------------

export const KNOWN_TYPES: TypeSet = new Set(COMPONENT_LIBRARY.map((c) => c.type))
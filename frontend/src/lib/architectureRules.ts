import { COMPONENT_LIBRARY, type ComponentCategory, type ComponentType } from '../components/nodes'

/**
 * Central architecture policy for the editor's static graph validator.
 *
 * Edges are directed: source -> target means traffic, a request, or data is
 * sent from the source component to the target component.
 *
 * Rules distinguish hard architectural mistakes from context-sensitive
 * warnings. They are design-time guidance, not a substitute for security review.
 *
 * Keep rules conservative: real systems legitimately use direct connections
 * (for example, signed object-storage URLs, CDC, database replication, and
 * telemetry agents). A warning should identify a meaningful risk, not merely
 * an uncommon topology.
 */

export type TypeSet = ReadonlySet<ComponentType>

const typeSet = (...types: ComponentType[]): TypeSet => new Set(types)

const typesInCategory = (category: ComponentCategory): TypeSet =>
  new Set(
    COMPONENT_LIBRARY
      .filter((component) => component.category === category)
      .map((component) => component.type),
  )

const union = (...sets: TypeSet[]): TypeSet =>
  new Set(sets.flatMap((set) => [...set]))

// ---------------------------------------------------------------------------
// Component families and graph entry points
// ---------------------------------------------------------------------------

/** All user/device/API clients, derived from the component catalogue. */
export const CLIENT_TYPES: TypeSet = typesInCategory('Client')

/** Components that can initiate work without an incoming graph edge. */
export const TRIGGER_TYPES: TypeSet = typeSet('cronJob', 'webhook')

/** Valid starting points for reachability analysis. */
export const ENTRY_TYPES: TypeSet = union(CLIENT_TYPES, TRIGGER_TYPES)

/** Stateless or event-driven components that execute application logic. */
export const COMPUTE_TYPES: TypeSet = typeSet(
  'service',
  'worker',
  'serverless',
  'autoScalingGroup',
  'containerOrchestrator',
  'cronJob',
)

/** Persistent or query-oriented data systems. */
export const DATA_STORE_TYPES: TypeSet = typeSet(
  'database',
  'cache',
  'dataWarehouse',
  'objectStorage',
  'searchIndex',
  'dataLake',
)

/** Components that distribute, filter, or route inbound network traffic. */
export const TRAFFIC_EDGE_TYPES: TypeSet = typeSet(
  'dns',
  'cdn',
  'loadBalancer',
  'apiGateway',
  'waf',
  'ingress',
)

/** Durable asynchronous transport components. */
export const MESSAGING_TYPES: TypeSet = typeSet(
  'queue',
  'messageBroker',
  'eventBus',
)

/** Third-party dependencies normally invoked by backend code. */
export const EXTERNAL_DEPENDENCY_TYPES: TypeSet = typeSet(
  'thirdPartyApi',
  'paymentGateway',
)

// ---------------------------------------------------------------------------
// Connection compatibility
// ---------------------------------------------------------------------------

export interface ConnectionRule {
  /** Stable identifier used for diagnostics and tests. */
  id: string
  severity: 'error' | 'warning'
  matches: (source: ComponentType, target: ComponentType) => boolean
  /** Receives display names of source and target components. */
  message: (source: string, target: string) => string
}

const CLIENT_DIRECT_DATA_TYPES = typeSet(
  'database',
  'cache',
  'dataWarehouse',
  'searchIndex',
  'dataLake',
)

const BACKEND_CALLER_TYPES = typeSet(
  'service',
  'worker',
  'serverless',
  'cronJob',
)

const ASYNC_CONSUMERS = typeSet(
  'service',
  'worker',
  'serverless',
)

/**
 * Rules are evaluated in order.
 * The first matching rule is reported per edge.
 *
 * High-confidence security violations come before
 * context-dependent architectural warnings.
 */
export const CONNECTION_RULES: readonly ConnectionRule[] = [
  {
    id: 'client-to-payment-gateway',
    severity: 'error',

    matches: (source, target) =>
      CLIENT_TYPES.has(source) && target === 'paymentGateway',

    message: (source, target) =>
      `${source} calls ${target} directly. Keep payment-provider secrets and payment orchestration on a trusted backend; the client should call your backend instead.`,
  },

  {
    id: 'client-to-private-data-store',
    severity: 'error',

    matches: (source, target) =>
      CLIENT_TYPES.has(source) && CLIENT_DIRECT_DATA_TYPES.has(target),

    message: (source, target) =>
      `${source} connects directly to ${target}. This can expose credentials or bypass authorization, validation, and business logic. Route access through a backend service or API Gateway.`,
  },

  {
    id: 'client-to-message-transport',
    severity: 'warning',

    matches: (source, target) =>
      CLIENT_TYPES.has(source) && MESSAGING_TYPES.has(target),

    message: (source, target) =>
      `${source} publishes directly to ${target}. Use a backend publisher by default; direct device publishing is appropriate only with short-lived, scoped credentials, tenant isolation, quotas, and abuse protection.`,
  },

  {
    id: 'client-to-object-storage',
    severity: 'warning',

    matches: (source, target) =>
      CLIENT_TYPES.has(source) && target === 'objectStorage',

    message: (source, target) =>
      `${source} accesses ${target} directly. This is safe only with narrowly scoped, short-lived signed URLs or equivalent delegated authorization; never embed storage credentials in the client.`,
  },

  {
    id: 'connection-into-client',
    severity: 'warning',

    matches: (_source, target) =>
      CLIENT_TYPES.has(target),

    message: (source, target) =>
      `${source} sends traffic to ${target}. Clients are normally traffic origins, not backend destinations. Check the edge direction; model callbacks as a Webhook or an explicit backend endpoint when appropriate.`,
  },

  {
    id: 'external-call-from-data-store',
    severity: 'warning',

    matches: (source, target) =>
      DATA_STORE_TYPES.has(source) && EXTERNAL_DEPENDENCY_TYPES.has(target),

    message: (source, target) =>
      `${source} is connected directly to ${target}. External API and payment calls should normally be orchestrated by a backend service or worker, not by a data store.`,
  },

  {
    id: 'payment-provider-not-called-by-backend',
    severity: 'warning',

    matches: (source, target) =>
      target === 'paymentGateway' && !BACKEND_CALLER_TYPES.has(source),

    message: (source, target) =>
      `${source} calls ${target}. Put payment creation, signature verification, idempotency, and webhook reconciliation in a trusted backend service or worker.`,
  },

  {
    id: 'external-api-not-called-by-backend',
    severity: 'warning',

    matches: (source, target) =>
      target === 'thirdPartyApi' && !BACKEND_CALLER_TYPES.has(source),

    message: (source, target) =>
      `${source} calls ${target}. A backend service or worker should normally own API credentials, retries, timeouts, rate limits, and failure handling.`,
  },

  {
    id: 'traffic-edge-to-data-store',
    severity: 'warning',

    matches: (source, target) =>
      TRAFFIC_EDGE_TYPES.has(source) &&
      DATA_STORE_TYPES.has(target) &&
      !(source === 'cdn' && target === 'objectStorage'),

    message: (source, target) =>
      `${source} connects directly to ${target}. Network-edge components should normally route to an application/compute layer. Direct CDN-to-object-storage origins are a valid exception when access is restricted and origin protection is configured.`,
  },

  {
    id: 'queue-to-non-consumer',
    severity: 'warning',

    matches: (source, target) =>
      (
        source === 'queue' ||
        source === 'messageBroker' ||
        source === 'eventBus'
      ) &&
      !ASYNC_CONSUMERS.has(target) &&
      !MESSAGING_TYPES.has(target),

    message: (source, target) =>
      `${source} delivers messages to ${target}. Queues and brokers are normally consumed by a worker, service, or serverless function; confirm that the target supports the required consumer protocol and acknowledgement semantics.`,
  },
]

// ---------------------------------------------------------------------------
// Required downstream connections
// ---------------------------------------------------------------------------

export interface DownstreamRule {
  id: string
  types: TypeSet
  /** Receives the display name of the component. */
  message: (name: string) => string
}

/**
 * Components whose primary responsibility is forwarding, triggering,
 * or producing work require a downstream destination.
 *
 * Terminal components such as databases, object stores, third-party APIs,
 * and payment providers are deliberately excluded because they can
 * validly terminate a modeled flow.
 */
export const DOWNSTREAM_REQUIREMENTS: readonly DownstreamRule[] = [
  {
    id: 'client-needs-target',
    types: CLIENT_TYPES,

    message: (name) =>
      `${name} has no outgoing connection, so its requests have no modeled destination.`,
  },

  {
    id: 'network-forwarder-needs-target',
    types: TRAFFIC_EDGE_TYPES,

    message: (name) =>
      `${name} forwards or filters traffic but has no downstream destination. Connect it to the next network or application component.`,
  },

  {
    id: 'async-producer-needs-consumer',
    types: MESSAGING_TYPES,

    message: (name) =>
      `${name} has no downstream consumer or subscription target, so published messages have no modeled processing path.`,
  },

  {
    id: 'trigger-needs-target',
    types: TRIGGER_TYPES,

    message: (name) =>
      `${name} can start work but has no downstream destination, so the trigger performs no modeled action.`,
  },
]

// ---------------------------------------------------------------------------
// Known component types
// ---------------------------------------------------------------------------

/** Derived from the single source of truth used by the editor palette. */
export const KNOWN_TYPES: TypeSet = new Set(
  COMPONENT_LIBRARY.map((component) => component.type),
)

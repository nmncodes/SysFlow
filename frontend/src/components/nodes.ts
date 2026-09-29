export type ComponentType =
  | 'client'
  | 'mobile'
  | 'webBrowser'
  | 'desktopApp'
  | 'apiClient'
  | 'dns'
  | 'cdn'
  | 'loadBalancer'
  | 'apiGateway'
  | 'waf'
  | 'ingress'
  | 'service'
  | 'worker'
  | 'serverless'
  | 'queue'
  | 'autoScalingGroup'
  | 'containerOrchestrator'
  | 'cronJob'
  | 'cache'
  | 'database'
  | 'dataWarehouse'
  | 'objectStorage'
  | 'searchIndex'
  | 'dataLake'
  | 'messageBroker'
  | 'eventBus'
  | 'webhook'
  | 'monitoring'
  | 'logging'
  | 'thirdPartyApi'
  | 'paymentGateway'

export type ComponentCategory = 'Client' | 'Traffic & Edge' | 'Compute' | 'Data' | 'Messaging' | 'Observability' | 'External'

export const COMPONENT_FAMILY_COLORS: Record<ComponentCategory, string> = {
  Client: '#16a34a',
  'Traffic & Edge': '#0891b2',
  Compute: '#eab308',
  Data: '#2563eb',
  Messaging: '#d97706',
  Observability: '#64748b',
  External: '#db2777',
}

export function getComponentFamilyColor(componentType: string): string {
  const def = COMPONENT_LIBRARY.find((c) => c.type === componentType)
  return def ? COMPONENT_FAMILY_COLORS[def.category] : '#64748b'
}

export function isClientComponent(componentType: string): boolean {
  const def = COMPONENT_LIBRARY.find((c) => c.type === componentType)
  return def?.category === 'Client'
}

export function getAggregateClientRps(
  nodes: { data: { componentType: string; config?: Record<string, unknown> } }[],
): number {
  const clients = nodes.filter((n) => isClientComponent(n.data.componentType))
  if (clients.length === 0) return 0
  return clients.reduce((sum, n) => {
    const raw = Number(n.data.config?.targetRps ?? 100)
    return sum + (Number.isFinite(raw) && raw > 0 ? raw : 100)
  }, 0)
}

export interface ComponentDef {
  type: ComponentType
  label: string
  category: ComponentCategory
  description: string
  examples: string
  defaultConfig: Record<string, unknown>
}

export function formatComponentSpecs(def: ComponentDef, configOverride?: Record<string, unknown>): string[] {
  const cfg = { ...def.defaultConfig, ...(configOverride ?? {}) }
  const specs: string[] = []
  if (def.category === 'Client') {
    specs.push(`Target: ${cfg.targetRps ?? 100} RPS`)
  }
  if (cfg.maxThroughput !== undefined) {
    specs.push(`Capacity: ${Number(cfg.maxThroughput).toLocaleString()} RPS`)
  }
  if (cfg.maxConcurrency !== undefined) {
    specs.push(`Concurrency: ${Number(cfg.maxConcurrency).toLocaleString()}`)
  }
  if (cfg.rateLimit !== undefined) {
    specs.push(`Rate Limit: ${Number(cfg.rateLimit).toLocaleString()} RPS`)
  }
  if (cfg.hitRatePct !== undefined) {
    specs.push(`Hit Rate: ${cfg.hitRatePct}%`)
  }
  if (cfg.minLatencyMs !== undefined && cfg.maxLatencyMs !== undefined) {
    specs.push(`Latency: ${cfg.minLatencyMs}–${cfg.maxLatencyMs}ms`)
  } else if (cfg.readLatencyMs !== undefined && cfg.writeLatencyMs !== undefined) {
    specs.push(`R/W: ${cfg.readLatencyMs}ms / ${cfg.writeLatencyMs}ms`)
  } else if (cfg.resolutionLatencyMs !== undefined) {
    specs.push(`Lookup: ${cfg.resolutionLatencyMs}ms`)
  }
  if (cfg.minReplicas !== undefined && cfg.maxReplicas !== undefined) {
    specs.push(`Replicas: ${cfg.minReplicas}–${cfg.maxReplicas}`)
  }
  return specs.slice(0, 3)
}

export const COMPONENT_LIBRARY: ComponentDef[] = [
  // Client
  {
    type: 'client',
    label: 'Client',
    category: 'Client',
    description: 'General end-user or consumer origin that generates incoming traffic into your architecture.',
    examples: 'User Traffic · Load Generator',
    defaultConfig: { targetRps: 100 },
  },
  {
    type: 'mobile',
    label: 'Mobile App',
    category: 'Client',
    description: 'Native iOS or Android client sending API requests over cellular and Wi-Fi networks.',
    examples: 'iOS App · Android App · React Native',
    defaultConfig: { targetRps: 100 },
  },
  {
    type: 'webBrowser',
    label: 'Web Browser',
    category: 'Client',
    description: 'Single-page or server-rendered web application making HTTP/HTTPS requests from user browsers.',
    examples: 'React SPA · Next.js · Chrome/Safari',
    defaultConfig: { targetRps: 100 },
  },
  {
    type: 'desktopApp',
    label: 'Desktop App',
    category: 'Client',
    description: 'Native desktop software communicating with backend APIs via REST, gRPC, or WebSockets.',
    examples: 'Electron · macOS/Windows Native',
    defaultConfig: { targetRps: 100 },
  },
  {
    type: 'apiClient',
    label: 'API Client',
    category: 'Client',
    description: 'Automated SDK, CLI, or B2B partner integration calling your endpoints programmatically.',
    examples: 'Partner Webhook · SDK · CLI Bot',
    defaultConfig: { targetRps: 100 },
  },

  // Traffic & Edge
  {
    type: 'dns',
    label: 'DNS',
    category: 'Traffic & Edge',
    description: 'Domain Name System resolver that translates domain names into routable IP addresses at the edge.',
    examples: 'Route 53 · Cloudflare DNS',
    defaultConfig: { resolutionLatencyMs: 5 },
  },
  {
    type: 'cdn',
    label: 'CDN',
    category: 'Traffic & Edge',
    description: 'Geographically distributed edge cache that serves static content close to users and shields origin servers.',
    examples: 'CloudFront · Cloudflare · Fastly',
    defaultConfig: { hitRatePct: 90, hitLatencyMs: 3, missLatencyMs: 35 },
  },
  {
    type: 'loadBalancer',
    label: 'Load Balancer',
    category: 'Traffic & Edge',
    description: 'Distributes incoming network or HTTP requests evenly across healthy backend instances to prevent overload.',
    examples: 'AWS ALB/NLB · NGINX · HAProxy',
    defaultConfig: { algorithm: 'round-robin', maxThroughput: 1000 },
  },
  {
    type: 'apiGateway',
    label: 'API Gateway',
    category: 'Traffic & Edge',
    description: 'Unified entry point that handles request routing, auth, rate limiting, and API throttling.',
    examples: 'Kong · AWS API Gateway · Apigee',
    defaultConfig: { rateLimit: 500 },
  },
  {
    type: 'waf',
    label: 'WAF',
    category: 'Traffic & Edge',
    description: 'Web Application Firewall that inspects HTTP traffic to block SQLi, XSS, and volumetric attacks.',
    examples: 'AWS WAF · Cloudflare WAF',
    defaultConfig: { maxThroughput: 2000, extraLatencyMs: 2 },
  },
  {
    type: 'ingress',
    label: 'Ingress',
    category: 'Traffic & Edge',
    description: 'Cluster edge controller managing external HTTP/S routing and TLS termination into internal services.',
    examples: 'NGINX Ingress · Traefik · Envoy',
    defaultConfig: { maxThroughput: 1500 },
  },

  // Compute
  {
    type: 'service',
    label: 'Service',
    category: 'Compute',
    description: 'Stateless backend microservice or API server that executes core business logic and queries data stores.',
    examples: 'Spring Boot · Node.js · Go API',
    defaultConfig: { scale: 'Auto', minLatencyMs: 20, maxLatencyMs: 80, maxConcurrency: 500, failureRateAtSaturation: 5 },
  },
  {
    type: 'worker',
    label: 'Worker',
    category: 'Compute',
    description: 'Asynchronous background processor that pulls jobs from queues to run heavy or deferred tasks off the critical path.',
    examples: 'Celery · Sidekiq · BullMQ Worker',
    defaultConfig: { scale: 'Auto', minLatencyMs: 30, maxLatencyMs: 150, maxConcurrency: 300, failureRateAtSaturation: 5 },
  },
  {
    type: 'serverless',
    label: 'Serverless',
    category: 'Compute',
    description: 'Event-driven function compute that scales to zero and spins up on demand per request.',
    examples: 'AWS Lambda · Cloud Functions',
    defaultConfig: { scale: 'Auto', minLatencyMs: 40, maxLatencyMs: 300, maxConcurrency: 1000, failureRateAtSaturation: 3 },
  },
  {
    type: 'queue',
    label: 'Message Queue',
    category: 'Compute',
    description: 'Asynchronous task buffer that decouples producers from workers and absorbs sudden traffic bursts.',
    examples: 'AWS SQS · RabbitMQ · ActiveMQ',
    defaultConfig: { maxThroughput: 1000, consumers: 1 },
  },
  {
    type: 'autoScalingGroup',
    label: 'Auto-Scaling Group',
    category: 'Compute',
    description: 'Elastic pool of VM instances that automatically scales replica count up or down based on load.',
    examples: 'AWS EC2 ASG · GCP MIG',
    defaultConfig: { scale: 'Auto', minReplicas: 1, maxReplicas: 10, targetLoadPct: 70, baseCapacityPerReplica: 500, minLatencyMs: 20, maxLatencyMs: 80 },
  },
  {
    type: 'containerOrchestrator',
    label: 'Container Orchestrator',
    category: 'Compute',
    description: 'Cluster manager that schedules, scales, and self-heals containerized microservices across nodes.',
    examples: 'Kubernetes (EKS/GKE) · AWS ECS',
    defaultConfig: { scale: 'Auto', minReplicas: 2, maxReplicas: 20, targetLoadPct: 70, baseCapacityPerReplica: 600, minLatencyMs: 15, maxLatencyMs: 70 },
  },
  {
    type: 'cronJob',
    label: 'Cron Job',
    category: 'Compute',
    description: 'Time-scheduled batch runner for periodic cleanup, billing, data sync, or report generation.',
    examples: 'K8s CronJob · EventBridge Scheduler',
    defaultConfig: { scale: 'Auto', minLatencyMs: 50, maxLatencyMs: 400, maxConcurrency: 50, failureRateAtSaturation: 5 },
  },

  // Data
  {
    type: 'cache',
    label: 'Cache',
    category: 'Data',
    description: 'In-memory key-value store that serves hot reads in sub-milliseconds to offload primary databases.',
    examples: 'Redis · Memcached · ElastiCache',
    defaultConfig: { scale: 'Auto', hitRatePct: 80, hitLatencyMs: 2, missLatencyMs: 40 },
  },
  {
    type: 'database',
    label: 'Database',
    category: 'Data',
    description: 'Primary transactional datastore (OLTP) for durable reads and writes with connection pooling and replicas.',
    examples: 'PostgreSQL · MySQL · DynamoDB',
    defaultConfig: { scale: 'Auto', readLatencyMs: 15, writeLatencyMs: 30, maxConnections: 200, replicaCount: 0 },
  },
  {
    type: 'dataWarehouse',
    label: 'Data Warehouse',
    category: 'Data',
    description: 'Columnar analytical database (OLAP) built for large-scale aggregations, reporting, and BI queries.',
    examples: 'Snowflake · BigQuery · Redshift',
    defaultConfig: { scale: 'Auto', readLatencyMs: 60, writeLatencyMs: 100, maxConnections: 100, replicaCount: 0 },
  },
  {
    type: 'objectStorage',
    label: 'Object Storage',
    category: 'Data',
    description: 'Highly durable, massively scalable blob store for unstructured files, images, videos, and backups.',
    examples: 'AWS S3 · GCS · Azure Blob',
    defaultConfig: { readLatencyMs: 25, writeLatencyMs: 50, maxThroughput: 3000 },
  },
  {
    type: 'searchIndex',
    label: 'Search Index',
    category: 'Data',
    description: 'Inverted-index search engine optimized for low-latency full-text search, faceting, and log querying.',
    examples: 'Elasticsearch · OpenSearch · Algolia',
    defaultConfig: { readLatencyMs: 20, writeLatencyMs: 40, maxConnections: 300, replicaCount: 0 },
  },
  {
    type: 'dataLake',
    label: 'Data Lake',
    category: 'Data',
    description: 'Centralized repository storing raw structured and unstructured data at petabyte scale for ML and analytics.',
    examples: 'Delta Lake · Apache Iceberg · S3 Lake',
    defaultConfig: { readLatencyMs: 80, writeLatencyMs: 120, maxConnections: 100 },
  },

  // Messaging
  {
    type: 'messageBroker',
    label: 'Message Broker',
    category: 'Messaging',
    description: 'High-throughput distributed event streaming platform for durable pub/sub messaging across services.',
    examples: 'Apache Kafka · Redpanda · Pulsar',
    defaultConfig: { maxThroughput: 2000, consumers: 3 },
  },
  {
    type: 'eventBus',
    label: 'Event Bus',
    category: 'Messaging',
    description: 'Serverless event router that filters and broadcasts domain events to decoupled subscribers.',
    examples: 'AWS EventBridge · GCP Pub/Sub',
    defaultConfig: { maxThroughput: 3000 },
  },
  {
    type: 'webhook',
    label: 'Webhook',
    category: 'Messaging',
    description: 'Outbound HTTP callback dispatcher that pushes real-time event payloads to external subscriber URLs.',
    examples: 'Svix · Custom HTTP Dispatcher',
    defaultConfig: { maxThroughput: 300, extraLatencyMs: 20 },
  },

  // Observability
  {
    type: 'monitoring',
    label: 'Monitoring',
    category: 'Observability',
    description: 'Time-series telemetry and alerting platform that tracks service health, latency, and saturation.',
    examples: 'Prometheus · Grafana · Datadog',
    defaultConfig: { maxThroughput: 5000 },
  },
  {
    type: 'logging',
    label: 'Logging',
    category: 'Observability',
    description: 'Centralized log ingestion and indexing pipeline for distributed tracing, auditing, and debugging.',
    examples: 'ELK Stack · Grafana Loki · Splunk',
    defaultConfig: { maxThroughput: 5000 },
  },

  // External
  {
    type: 'thirdPartyApi',
    label: 'Third-Party API',
    category: 'External',
    description: 'External SaaS dependency outside your control with its own rate limits, SLA, and network latency.',
    examples: 'Twilio · SendGrid · OpenAI · Maps',
    defaultConfig: { maxThroughput: 200, minLatencyMs: 50, maxLatencyMs: 400 },
  },
  {
    type: 'paymentGateway',
    label: 'Payment Gateway',
    category: 'External',
    description: 'External PCI-compliant payment processor handling card authorization, fraud checks, and settlement.',
    examples: 'Stripe · Adyen · Razorpay · PayPal',
    defaultConfig: { maxThroughput: 150, minLatencyMs: 100, maxLatencyMs: 600 },
  },
]

export const COMPONENT_CATEGORIES: ComponentCategory[] = ['Client', 'Traffic & Edge', 'Compute', 'Data', 'Messaging', 'Observability', 'External']

export type HealthState = 'idle' | 'healthy' | 'underLoad' | 'critical' | 'down'

export const HEALTH_COLORS: Record<HealthState, string> = {
  idle: '#6b7280',
  healthy: '#22c55e',
  underLoad: '#f59e0b',
  critical: '#f97316',
  down: '#ef4444',
}

export function deriveHealth(loadPct: number, errorRatePct: number, down: boolean): HealthState {
  if (down) return 'down'
  if (loadPct > 85 || errorRatePct >= 5) return 'critical'
  if (loadPct >= 60 || errorRatePct >= 1) return 'underLoad'
  return 'healthy'
}

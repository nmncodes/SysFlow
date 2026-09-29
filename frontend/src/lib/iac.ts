import type { ComponentType } from '../components/nodes'

interface GraphNodeLike {
  id: string
  type: string
  label?: string
  config?: Record<string, unknown>
}

interface GraphEdgeLike {
  source: string
  target: string
}

interface ServiceSpec {
  /** 'image' pulls a real off-the-shelf image; 'build' means "you write the Dockerfile" — resolved to ./<serviceName> at generation time. */
  directive: 'image' | 'build'
  value?: string
  buildNote?: string
  ports?: { published: number; target: number }[]
  environment?: Record<string, string>
  volumes?: string[]
}

/**
 * Best-effort docker-compose service per component type — a starting point to edit, not a
 * production-ready deployment. Types with no sensible self-hosted equivalent (managed services,
 * client-side code, external providers, or things that aren't a single container) are called
 * out as comments instead of a service block — see MANAGED_ONLY_NOTE.
 */
const SERVICE_SPECS: Partial<Record<ComponentType, ServiceSpec>> = {
  loadBalancer: { directive: 'image', value: 'nginx:1.27-alpine', ports: [{ published: 80, target: 80 }] },
  apiGateway: { directive: 'image', value: 'nginx:1.27-alpine', ports: [{ published: 8000, target: 80 }] },
  waf: { directive: 'image', value: 'owasp/modsecurity-crs:nginx' },
  ingress: { directive: 'image', value: 'nginx:1.27-alpine' },
  service: { directive: 'build', buildNote: 'your application code — add a Dockerfile here' },
  worker: { directive: 'build', buildNote: 'your background worker code — add a Dockerfile here' },
  serverless: { directive: 'build', buildNote: 'your function code — most serverless platforms don\'t run from compose; this is a local stand-in' },
  cronJob: { directive: 'build', buildNote: 'your scheduled job code — add a Dockerfile and your own cron/scheduler entrypoint' },
  autoScalingGroup: { directive: 'build', buildNote: 'your application code — add "deploy: replicas: N" (swarm) or move to k8s for real autoscaling' },
  queue: { directive: 'image', value: 'rabbitmq:3-management-alpine', ports: [{ published: 5672, target: 5672 }, { published: 15672, target: 15672 }] },
  messageBroker: { directive: 'image', value: 'bitnami/kafka:3.7', ports: [{ published: 9092, target: 9092 }], environment: { KAFKA_CFG_NODE_ID: '0', KAFKA_CFG_PROCESS_ROLES: 'controller,broker' } },
  eventBus: { directive: 'image', value: 'nats:2.10-alpine', ports: [{ published: 4222, target: 4222 }] },
  cache: { directive: 'image', value: 'redis:7-alpine', ports: [{ published: 6379, target: 6379 }] },
  database: { directive: 'image', value: 'postgres:16-alpine', ports: [{ published: 5432, target: 5432 }], environment: { POSTGRES_PASSWORD: 'change-me' }, volumes: ['pgdata:/var/lib/postgresql/data'] },
  searchIndex: { directive: 'image', value: 'opensearchproject/opensearch:2', ports: [{ published: 9200, target: 9200 }], environment: { 'discovery.type': 'single-node' } },
  objectStorage: { directive: 'image', value: 'minio/minio:latest', ports: [{ published: 9000, target: 9000 }, { published: 9001, target: 9001 }], environment: { MINIO_ROOT_USER: 'minioadmin', MINIO_ROOT_PASSWORD: 'change-me' }, volumes: ['objectdata:/data'] },
  monitoring: { directive: 'image', value: 'prom/prometheus:latest', ports: [{ published: 9090, target: 9090 }] },
  logging: { directive: 'image', value: 'grafana/loki:latest', ports: [{ published: 3100, target: 3100 }] },
}

const MANAGED_ONLY_NOTE: Partial<Record<ComponentType, string>> = {
  client: 'runs on the end user\'s device — not a backend service',
  mobile: 'runs on the end user\'s device — not a backend service',
  webBrowser: 'runs on the end user\'s device — not a backend service',
  iotDevice: 'runs on external hardware — not a backend service',
  dns: 'typically your registrar/DNS provider — not self-hosted',
  cdn: 'typically a managed CDN (Cloudflare/CloudFront) — not self-hosted here',
  containerOrchestrator: 'this IS the orchestrator (k8s/ECS/Swarm) — not something you run inside compose',
  dataWarehouse: 'typically a managed warehouse (BigQuery/Snowflake/Redshift) — not self-hosted here',
  dataLake: 'typically managed object storage + a catalog (S3+Glue, etc.) — not self-hosted here',
  webhook: 'an inbound endpoint on one of your services — add a route, not a separate container',
  thirdPartyApi: 'an external provider you call — nothing to deploy',
  paymentGateway: 'an external provider (Stripe/etc.) — nothing to deploy',
}

function sanitizeServiceName(id: string): string {
  const cleaned = id.toLowerCase().replace(/[^a-z0-9_-]/g, '_')
  return /^[a-z]/.test(cleaned) ? cleaned : `svc_${cleaned}`
}

function createServiceNames(nodes: GraphNodeLike[]): Map<string, string> {
  const names = new Map<string, string>()
  const usedIds = new Set<string>()
  const usedNames = new Set<string>()

  for (const node of nodes) {
    if (!node.id.trim() || usedIds.has(node.id)) {
      throw new Error('Cannot export Compose: every graph node must have a unique, non-empty ID.')
    }
    usedIds.add(node.id)

    const baseName = sanitizeServiceName(node.id)
    let name = baseName
    let suffix = 2
    while (usedNames.has(name)) name = `${baseName}_${suffix++}`
    usedNames.add(name)
    names.set(node.id, name)
  }
  return names
}

function createPublishedPorts(nodes: GraphNodeLike[]): Map<string, { published: number; target: number }[]> {
  const preferredPorts = new Set<number>()
  for (const node of nodes) {
    SERVICE_SPECS[node.type as ComponentType]?.ports?.forEach((port) => preferredPorts.add(port.published))
  }

  const usedPorts = new Set<number>()
  const result = new Map<string, { published: number; target: number }[]>()
  for (const node of nodes) {
    const spec = SERVICE_SPECS[node.type as ComponentType]
    if (!spec?.ports) continue
    const ports = spec.ports.map(({ published, target }) => {
      let hostPort = published
      if (usedPorts.has(hostPort)) {
        hostPort++
        while (usedPorts.has(hostPort) || preferredPorts.has(hostPort)) hostPort++
      }
      if (hostPort > 65535) throw new Error('Cannot export Compose: no free host port is available for every generated service.')
      usedPorts.add(hostPort)
      return { published: hostPort, target }
    })
    result.set(node.id, ports)
  }
  return result
}

function isDependencyCycle(dependent: string, dependency: string, dependencies: Map<string, Set<string>>): boolean {
  const visited = new Set<string>()
  const pending = [dependency]
  while (pending.length > 0) {
    const current = pending.pop()!
    if (current === dependent) return true
    if (visited.has(current)) continue
    visited.add(current)
    dependencies.get(current)?.forEach((next) => pending.push(next))
  }
  return false
}

function oneLine(value: string): string {
  const printable = [...value].map((character) => {
    const code = character.charCodeAt(0)
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f) || character === '\u2028' || character === '\u2029'
      ? ' '
      : character
  }).join('')
  return printable.replace(/\s+/g, ' ').trim()
}

export function generateDockerCompose(nodes: GraphNodeLike[], edges: GraphEdgeLike[]): string {
  const deployable = nodes.filter((n) => SERVICE_SPECS[n.type as ComponentType])
  const serviceNames = createServiceNames(nodes)
  const deployableIds = new Set(deployable.map((node) => node.id))
  const publishedPorts = createPublishedPorts(deployable)
  const skipped = nodes.filter((n) => !deployable.includes(n))

  const lines: string[] = [
    '# Generated by SysFlow from your architecture diagram — a STARTING POINT, not a deployable',
    '# production stack. Placeholder images, secrets, and volumes all need real values.',
    '',
  ]

  if (skipped.length > 0) {
    lines.push('# Not included as containers:')
    for (const n of skipped) {
      const note = MANAGED_ONLY_NOTE[n.type as ComponentType] ?? 'no self-hosted equivalent mapped for this component type'
      lines.push(`#   - ${oneLine(n.label ?? n.id)} (${oneLine(n.type)}): ${oneLine(note)}`)
    }
    lines.push('')
  }

  if (deployable.length === 0) {
    lines.push('services: {}')
    return lines.join('\n')
  }

  lines.push('services:')
  const volumeNames = new Set<string>()
  const dependencies = new Map<string, Set<string>>()
  const skippedDependencies: string[] = []

  for (const node of deployable) {
    const spec = SERVICE_SPECS[node.type as ComponentType]!
    const serviceName = serviceNames.get(node.id)!
    if (serviceName !== sanitizeServiceName(node.id)) {
      lines.push(`  # node id "${oneLine(node.id)}" mapped to Compose service "${serviceName}"`)
    }
    const dependsOnSet = new Set<string>()
    for (const edge of edges.filter((candidate) => candidate.target === node.id && deployableIds.has(candidate.source))) {
      const dependencyName = serviceNames.get(edge.source)!
      if (dependencyName === serviceName || isDependencyCycle(serviceName, dependencyName, dependencies)) {
        skippedDependencies.push(`${oneLine(edge.source)} -> ${oneLine(edge.target)}`)
        continue
      }
      dependsOnSet.add(dependencyName)
      if (!dependencies.has(serviceName)) dependencies.set(serviceName, new Set())
      dependencies.get(serviceName)!.add(dependencyName)
    }
    const dependsOn = [...dependsOnSet]

    if (spec.directive === 'build') {
      lines.push(`  # ${oneLine(spec.buildNote ?? '')}`)
      lines.push(`  ${serviceName}:`)
      lines.push(`    build: ./${serviceName}`)
    } else {
      lines.push(`  ${serviceName}:`)
      lines.push(`    image: ${spec.value}`)
    }
    const nodePorts = publishedPorts.get(node.id)
    if (nodePorts?.length) {
      lines.push('    ports:')
      for (let index = 0; index < nodePorts.length; index++) {
        const port = nodePorts[index]
        const preferred = spec.ports?.[index].published
        if (preferred !== port.published) lines.push(`      # host port adjusted from ${preferred} to avoid a collision`)
        lines.push(`      - "${port.published}:${port.target}"`)
      }
    }
    if (spec.environment && Object.keys(spec.environment).length > 0) {
      lines.push('    environment:')
      for (const [key, value] of Object.entries(spec.environment)) lines.push(`      ${key}: "${value}"`)
    }
    if (spec.volumes?.length) {
      lines.push('    volumes:')
      for (const volume of spec.volumes) {
        const [volumeName, ...mountPath] = volume.split(':')
        const uniqueVolumeName = `${volumeName}_${serviceName}`
        lines.push(`      - ${[uniqueVolumeName, ...mountPath].join(':')}`)
        volumeNames.add(uniqueVolumeName)
      }
    }
    if (dependsOn.length > 0) {
      lines.push('    depends_on:')
      for (const dep of dependsOn) lines.push(`      - ${dep}`)
    }
    lines.push('')
  }

  if (skippedDependencies.length > 0) {
    lines.push('# Dependencies omitted to keep the Compose service graph acyclic:')
    for (const edge of skippedDependencies) lines.push(`#   - ${edge}`)
  }

  if (volumeNames.size > 0) {
    lines.push('volumes:')
    for (const name of volumeNames) lines.push(`  ${name}:`)
  }

  return lines.join('\n')
}

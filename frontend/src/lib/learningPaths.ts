import type { GraphJson } from './projects'
import { COMPONENT_LIBRARY, type ComponentType } from '../components/nodes'

function cfg(type: ComponentType) {
  return { ...(COMPONENT_LIBRARY.find((c) => c.type === type)?.defaultConfig ?? {}) }
}

export interface Challenge {
  id: string
  title: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  description: string
  objectives: string[]
  hints: string[]
  targetRps: number
  maxP95Ms: number
  maxErrorRate: number
  requiredComponents: string[]
  starterGraph?: GraphJson
}

export interface LearningPath {
  id: string
  title: string
  description: string
  icon: string
  challenges: Challenge[]
}

export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'foundations',
    title: 'Foundations',
    description: 'Start from scratch - build, cache, balance, and survive your first failure.',
    icon: '🧱',
    challenges: [
      {
        id: 'f1-basic-3tier',
        title: 'Build a 3-Tier App',
        difficulty: 'beginner',
        description: 'Create the simplest working architecture: a client sends requests through a load balancer to a service backed by a database.',
        objectives: ['Add a Client, Load Balancer, Service, and Database', 'Connect them in order', 'Run the simulation and keep error rate under 5%'],
        hints: [
          'Drag components from the palette on the left - Client, Load Balancer, Service, Database.',
          'Connect them left to right: Client → LB → Service → DB.',
          'Hit "Run Simulation" and check the error rate in the metrics panel.',
        ],
        targetRps: 100,
        maxP95Ms: 500,
        maxErrorRate: 5,
        requiredComponents: ['client', 'loadBalancer', 'service', 'database'],
      },
      {
        id: 'f2-add-cache',
        title: 'Speed It Up With a Cache',
        difficulty: 'beginner',
        description: 'Your database is slow under load. Add a cache between the service and DB to absorb read traffic and bring latency down.',
        objectives: ['Add a Cache component', 'Connect the service to the cache', 'Achieve p95 latency under 200ms'],
        hints: [
          'Add a Cache node and connect Service → Cache.',
          'Keep the Service → Database edge - the cache handles cache misses by falling through to the DB.',
          'Configure a high cache hit rate (80%+) to see a real latency drop.',
        ],
        targetRps: 200,
        maxP95Ms: 200,
        maxErrorRate: 5,
        requiredComponents: ['client', 'service', 'database', 'cache'],
        starterGraph: {
          nodes: [
            { id: 'client', type: 'client', label: 'Client', config: cfg('client'), position: { x: 40, y: 160 } },
            { id: 'lb', type: 'loadBalancer', label: 'Load Balancer', config: cfg('loadBalancer'), position: { x: 280, y: 160 } },
            { id: 'svc', type: 'service', label: 'Service', config: cfg('service'), position: { x: 520, y: 160 } },
            { id: 'db', type: 'database', label: 'Database', config: cfg('database'), position: { x: 760, y: 260 } },
          ],
          edges: [
            { id: 'e1', source: 'client', target: 'lb' },
            { id: 'e2', source: 'lb', target: 'svc' },
            { id: 'e3', source: 'svc', target: 'db' },
          ],
        },
      },
      {
        id: 'f3-load-balance',
        title: 'Distribute the Load',
        difficulty: 'beginner',
        description: 'A single service instance is a bottleneck. Add multiple services behind the load balancer and handle 500 RPS without critical load.',
        objectives: ['Have at least 2 service instances (or duplicate services)', 'Handle 500 RPS', 'No node should go critical (>85% load)'],
        hints: [
          'Duplicate the service node - select it and click Duplicate in the toolbar.',
          'Connect the load balancer to both service instances.',
          'Both services should connect to the same database.',
        ],
        targetRps: 500,
        maxP95Ms: 400,
        maxErrorRate: 5,
        requiredComponents: ['client', 'loadBalancer', 'service', 'database'],
        starterGraph: {
          nodes: [
            { id: 'client', type: 'client', label: 'Client', config: { ...cfg('client'), targetRps: 500 }, position: { x: 40, y: 160 } },
            { id: 'lb', type: 'loadBalancer', label: 'Load Balancer', config: cfg('loadBalancer'), position: { x: 280, y: 160 } },
            { id: 'svc', type: 'service', label: 'Service', config: cfg('service'), position: { x: 520, y: 160 } },
            { id: 'db', type: 'database', label: 'Database', config: cfg('database'), position: { x: 760, y: 160 } },
          ],
          edges: [
            { id: 'e1', source: 'client', target: 'lb' },
            { id: 'e2', source: 'lb', target: 'svc' },
            { id: 'e3', source: 'svc', target: 'db' },
          ],
        },
      },
      {
        id: 'f4-survive-failure',
        title: 'Survive a Node Failure',
        difficulty: 'beginner',
        description: 'Your database just went down. Add redundancy so the system stays alive when any single component fails.',
        objectives: ['Eliminate all single points of failure', 'Right-click the DB and kill it - the system should still serve some requests', 'Keep error rate under 20% during the failure'],
        hints: [
          'The database is the obvious SPOF - add a second database or configure replicas.',
          'A cache can absorb reads while the DB is down, but writes will still fail.',
          'Consider adding a second service instance too so no single node brings everything down.',
        ],
        targetRps: 200,
        maxP95Ms: 500,
        maxErrorRate: 20,
        requiredComponents: ['client', 'loadBalancer', 'service', 'database'],
      },
    ],
  },
  {
    id: 'scale-up',
    title: 'Scale Up',
    description: 'Handle real traffic - 10k RPS, async processing, and read replicas.',
    icon: '📈',
    challenges: [
      {
        id: 's1-10k-rps',
        title: 'Handle 10,000 RPS',
        difficulty: 'intermediate',
        description: 'Design an architecture that can serve 10,000 requests per second without any node going critical. You\'ll need load balancing, caching, and possibly multiple service tiers.',
        objectives: ['Serve 10,000 RPS', 'p95 latency under 300ms', 'No node above 85% load'],
        hints: [
          'A single service can\'t handle 10k RPS - you need several behind a load balancer.',
          'A cache with high hit rate dramatically reduces DB pressure.',
          'Consider an API gateway in front for rate limiting to protect downstream services.',
        ],
        targetRps: 10000,
        maxP95Ms: 300,
        maxErrorRate: 2,
        requiredComponents: ['client', 'loadBalancer', 'service', 'database', 'cache'],
      },
      {
        id: 's2-async-queue',
        title: 'Go Async With Queues',
        difficulty: 'intermediate',
        description: 'Your API is slow because it does heavy processing synchronously. Offload work to a message queue and background workers to keep response times fast.',
        objectives: ['Add a message queue and at least one worker', 'API p95 latency under 150ms', 'All queued work gets processed (error rate < 3%)'],
        hints: [
          'The service should enqueue work to a message queue instead of processing inline.',
          'Add a Worker node that consumes from the queue.',
          'The client only waits for the enqueue - the heavy work happens asynchronously.',
        ],
        targetRps: 1000,
        maxP95Ms: 150,
        maxErrorRate: 3,
        requiredComponents: ['client', 'service', 'queue', 'worker', 'database'],
      },
      {
        id: 's3-read-replicas',
        title: 'Read Replicas for Read-Heavy Traffic',
        difficulty: 'intermediate',
        description: 'Your app is 90% reads. The single database is the bottleneck. Split read and write paths using read replicas to handle the load.',
        objectives: ['Separate read and write database paths', 'Handle 5,000 RPS with p95 under 200ms', 'Use a cache for the hottest reads'],
        hints: [
          'Add a second database node as a "read replica" - route reads there, writes to the primary.',
          'You can have separate service instances for reads vs writes, connected to different DBs.',
          'A cache in front of the read path absorbs the most repeated queries.',
        ],
        targetRps: 5000,
        maxP95Ms: 200,
        maxErrorRate: 3,
        requiredComponents: ['client', 'loadBalancer', 'service', 'database', 'cache'],
      },
    ],
  },
  {
    id: 'resilience',
    title: 'Resilience',
    description: 'Design systems that survive chaos - eliminate SPOFs, go multi-region, handle cascading failures.',
    icon: '🛡️',
    challenges: [
      {
        id: 'r1-zero-spof',
        title: 'Eliminate Every SPOF',
        difficulty: 'advanced',
        description: 'Take this architecture and make it so that killing ANY single node doesn\'t bring the system down. Every component must have redundancy.',
        objectives: ['Zero single points of failure detected by the analyzer', 'System survives any single node kill with error rate < 10%', 'At least 6 nodes in the architecture'],
        hints: [
          'Run the "Analyze" tool - it shows SPOFs. Eliminate each one.',
          'Every non-client component needs either a replica or a redundant path.',
          'Load balancers and API gateways are SPOFs too - add a second one or use DNS failover.',
        ],
        targetRps: 500,
        maxP95Ms: 400,
        maxErrorRate: 10,
        requiredComponents: ['client', 'loadBalancer', 'service', 'database'],
        starterGraph: {
          nodes: [
            { id: 'client', type: 'client', label: 'Client', config: cfg('client'), position: { x: 40, y: 160 } },
            { id: 'lb', type: 'loadBalancer', label: 'Load Balancer', config: cfg('loadBalancer'), position: { x: 280, y: 160 } },
            { id: 'svc', type: 'service', label: 'API Service', config: cfg('service'), position: { x: 520, y: 160 } },
            { id: 'cache', type: 'cache', label: 'Cache', config: cfg('cache'), position: { x: 760, y: 60 } },
            { id: 'db', type: 'database', label: 'Database', config: cfg('database'), position: { x: 760, y: 260 } },
          ],
          edges: [
            { id: 'e1', source: 'client', target: 'lb' },
            { id: 'e2', source: 'lb', target: 'svc' },
            { id: 'e3', source: 'svc', target: 'cache' },
            { id: 'e4', source: 'svc', target: 'db' },
          ],
        },
      },
      {
        id: 'r2-multi-region',
        title: 'Design for Multi-Region',
        difficulty: 'advanced',
        description: 'Build an architecture that could serve users from two regions. Use a CDN, DNS load balancing, and replicated backends. The goal is low latency for everyone.',
        objectives: ['Include DNS/CDN for global routing', 'Have at least 2 independent service stacks', 'p95 under 250ms at 2,000 RPS'],
        hints: [
          'Start with DNS → CDN as the entry point.',
          'Behind the CDN, have two separate LB → Service → DB stacks representing two regions.',
          'Each region should have its own cache to keep reads local.',
        ],
        targetRps: 2000,
        maxP95Ms: 250,
        maxErrorRate: 3,
        requiredComponents: ['client', 'cdn', 'loadBalancer', 'service', 'database'],
      },
      {
        id: 'r3-cascading-failures',
        title: 'Stop Cascading Failures',
        difficulty: 'advanced',
        description: 'When one service goes down, it shouldn\'t take everything with it. Design circuit-breaker patterns using queues and API gateways with rate limiting to contain failures.',
        objectives: ['Kill the heaviest service - upstream services should degrade gracefully, not crash', 'Use an API gateway with rate limiting', 'Error rate < 15% during a service failure at 1,000 RPS'],
        hints: [
          'An API gateway with rate limiting prevents a flood of retries from overwhelming surviving services.',
          'A message queue between services decouples them - if the consumer is down, messages wait.',
          'Multiple service instances mean one dying doesn\'t take the others with it.',
        ],
        targetRps: 1000,
        maxP95Ms: 400,
        maxErrorRate: 15,
        requiredComponents: ['client', 'apiGateway', 'service', 'queue'],
      },
    ],
  },
]

export function findChallenge(challengeId: string): { path: LearningPath; challenge: Challenge } | null {
  for (const path of LEARNING_PATHS) {
    const challenge = path.challenges.find((c) => c.id === challengeId)
    if (challenge) return { path, challenge }
  }
  return null
}

const STORAGE_KEY = 'sysflow-challenge-progress'

export function getCompletedChallenges(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

export function markChallengeComplete(challengeId: string) {
  const completed = getCompletedChallenges()
  completed.add(challengeId)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed])) } catch { /* full */ }
}

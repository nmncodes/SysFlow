import type { GraphJson } from './projects'
import { COMPONENT_LIBRARY, type ComponentType } from '../components/nodes'

function cfg(type: ComponentType) {
  return { ...(COMPONENT_LIBRARY.find((c) => c.type === type)?.defaultConfig ?? {}) }
}

export interface Template {
  id: string
  name: string
  description: string
  graph: GraphJson
}

export const TEMPLATES: Template[] = [
  {
    id: 'basic-3-tier',
    name: 'Basic 3-Tier App',
    description: 'The starting point for almost everything: client, load balancer, service, database.',
    graph: {
      nodes: [
        { id: 'client', type: 'client', label: 'Client', config: cfg('client'), position: { x: 40, y: 160 } },
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
    id: 'url-shortener',
    name: 'URL Shortener',
    description: 'Read-heavy: an API gateway, a cache in front of the database for redirect lookups.',
    graph: {
      nodes: [
        { id: 'client', type: 'client', label: 'Client', config: cfg('client'), position: { x: 40, y: 180 } },
        { id: 'gw', type: 'apiGateway', label: 'API Gateway', config: cfg('apiGateway'), position: { x: 280, y: 180 } },
        { id: 'svc', type: 'service', label: 'Redirect Service', config: cfg('service'), position: { x: 520, y: 180 } },
        { id: 'cache', type: 'cache', label: 'Cache', config: cfg('cache'), position: { x: 760, y: 60 } },
        { id: 'db', type: 'database', label: 'Database', config: cfg('database'), position: { x: 760, y: 300 } },
      ],
      edges: [
        { id: 'e1', source: 'client', target: 'gw' },
        { id: 'e2', source: 'gw', target: 'svc' },
        { id: 'e3', source: 'svc', target: 'cache' },
        { id: 'e4', source: 'svc', target: 'db' },
      ],
    },
  },
  {
    id: 'chat-app',
    name: 'Chat App',
    description: 'Async fan-out: a message queue decouples the API from delivery workers.',
    graph: {
      nodes: [
        { id: 'client', type: 'client', label: 'Client', config: cfg('client'), position: { x: 40, y: 100 } },
        { id: 'mobile', type: 'mobile', label: 'Mobile', config: cfg('mobile'), position: { x: 40, y: 280 } },
        { id: 'lb', type: 'loadBalancer', label: 'Load Balancer', config: cfg('loadBalancer'), position: { x: 280, y: 190 } },
        { id: 'svc', type: 'service', label: 'Chat Service', config: cfg('service'), position: { x: 520, y: 190 } },
        { id: 'queue', type: 'queue', label: 'Message Queue', config: cfg('queue'), position: { x: 760, y: 190 } },
        { id: 'worker', type: 'worker', label: 'Delivery Worker', config: cfg('worker'), position: { x: 1000, y: 100 } },
        { id: 'db', type: 'database', label: 'Database', config: cfg('database'), position: { x: 1000, y: 300 } },
      ],
      edges: [
        { id: 'e1', source: 'client', target: 'lb' },
        { id: 'e2', source: 'mobile', target: 'lb' },
        { id: 'e3', source: 'lb', target: 'svc' },
        { id: 'e4', source: 'svc', target: 'queue' },
        { id: 'e5', source: 'svc', target: 'db' },
        { id: 'e6', source: 'queue', target: 'worker' },
      ],
    },
  },
]

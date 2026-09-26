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
  {
    id: 'ecommerce-platform',
    name: 'E-Commerce Platform',
    description: 'Scalable shopping flow with gateway routing, caching, orders, payments and asynchronous processing.',
    graph: {
      nodes: [
        { id: 'client', type: 'webBrowser', label: 'Web Browser', config: cfg('webBrowser'), position: { x: 40, y: 210 } },
        { id: 'gw', type: 'apiGateway', label: 'API Gateway', config: cfg('apiGateway'), position: { x: 260, y: 210 } },
        { id: 'lb', type: 'loadBalancer', label: 'Load Balancer', config: cfg('loadBalancer'), position: { x: 480, y: 210 } },
        { id: 'catalog', type: 'service', label: 'Catalog Service', config: cfg('service'), position: { x: 720, y: 80 } },
        { id: 'order', type: 'service', label: 'Order Service', config: cfg('service'), position: { x: 720, y: 250 } },
        { id: 'cache', type: 'cache', label: 'Product Cache', config: cfg('cache'), position: { x: 960, y: 40 } },
        { id: 'db', type: 'database', label: 'Commerce DB', config: cfg('database'), position: { x: 960, y: 210 } },
        { id: 'payment', type: 'paymentGateway', label: 'Payment Gateway', config: cfg('paymentGateway'), position: { x: 960, y: 380 } },
        { id: 'queue', type: 'queue', label: 'Order Queue', config: cfg('queue'), position: { x: 1200, y: 250 } },
        { id: 'worker', type: 'worker', label: 'Order Worker', config: cfg('worker'), position: { x: 1420, y: 250 } },
      ],
      edges: [
        { id: 'e1', source: 'client', target: 'gw' },
        { id: 'e2', source: 'gw', target: 'lb' },
        { id: 'e3', source: 'lb', target: 'catalog' },
        { id: 'e4', source: 'lb', target: 'order' },
        { id: 'e5', source: 'catalog', target: 'cache' },
        { id: 'e6', source: 'catalog', target: 'db' },
        { id: 'e7', source: 'order', target: 'db' },
        { id: 'e8', source: 'order', target: 'payment' },
        { id: 'e9', source: 'order', target: 'queue' },
        { id: 'e10', source: 'queue', target: 'worker' },
      ],
    },
  },
  {
    id: 'social-media',
    name: 'Social Media Platform',
    description: 'Feed and media architecture using caching, persistent storage and asynchronous background processing.',
    graph: {
      nodes: [
        { id: 'mobile', type: 'mobile', label: 'Mobile Client', config: cfg('mobile'), position: { x: 40, y: 180 } },
        { id: 'gw', type: 'apiGateway', label: 'API Gateway', config: cfg('apiGateway'), position: { x: 270, y: 180 } },
        { id: 'lb', type: 'loadBalancer', label: 'Load Balancer', config: cfg('loadBalancer'), position: { x: 500, y: 180 } },
        { id: 'feed', type: 'service', label: 'Feed Service', config: cfg('service'), position: { x: 740, y: 80 } },
        { id: 'user', type: 'service', label: 'User Service', config: cfg('service'), position: { x: 740, y: 280 } },
        { id: 'cache', type: 'cache', label: 'Feed Cache', config: cfg('cache'), position: { x: 980, y: 40 } },
        { id: 'db', type: 'database', label: 'Social DB', config: cfg('database'), position: { x: 980, y: 230 } },
        { id: 'storage', type: 'objectStorage', label: 'Media Storage', config: cfg('objectStorage'), position: { x: 980, y: 420 } },
        { id: 'queue', type: 'messageBroker', label: 'Event Broker', config: cfg('messageBroker'), position: { x: 1220, y: 230 } },
        { id: 'worker', type: 'worker', label: 'Notification Worker', config: cfg('worker'), position: { x: 1450, y: 230 } },
      ],
      edges: [
        { id: 'e1', source: 'mobile', target: 'gw' },
        { id: 'e2', source: 'gw', target: 'lb' },
        { id: 'e3', source: 'lb', target: 'feed' },
        { id: 'e4', source: 'lb', target: 'user' },
        { id: 'e5', source: 'feed', target: 'cache' },
        { id: 'e6', source: 'feed', target: 'db' },
        { id: 'e7', source: 'user', target: 'db' },
        { id: 'e8', source: 'user', target: 'storage' },
        { id: 'e9', source: 'feed', target: 'queue' },
        { id: 'e10', source: 'queue', target: 'worker' },
      ],
    },
  },
  {
    id: 'video-streaming',
    name: 'Video Streaming Platform',
    description: 'Content delivery flow with CDN caching, streaming services and object storage for large media assets.',
    graph: {
      nodes: [
        { id: 'client', type: 'webBrowser', label: 'Web Client', config: cfg('webBrowser'), position: { x: 40, y: 190 } },
        { id: 'cdn', type: 'cdn', label: 'CDN', config: cfg('cdn'), position: { x: 270, y: 190 } },
        { id: 'gw', type: 'apiGateway', label: 'API Gateway', config: cfg('apiGateway'), position: { x: 500, y: 190 } },
        { id: 'lb', type: 'loadBalancer', label: 'Load Balancer', config: cfg('loadBalancer'), position: { x: 730, y: 190 } },
        { id: 'stream', type: 'service', label: 'Streaming Service', config: cfg('service'), position: { x: 970, y: 90 } },
        { id: 'catalog', type: 'service', label: 'Catalog Service', config: cfg('service'), position: { x: 970, y: 290 } },
        { id: 'storage', type: 'objectStorage', label: 'Video Storage', config: cfg('objectStorage'), position: { x: 1210, y: 90 } },
        { id: 'db', type: 'database', label: 'Metadata DB', config: cfg('database'), position: { x: 1210, y: 290 } },
      ],
      edges: [
        { id: 'e1', source: 'client', target: 'cdn' },
        { id: 'e2', source: 'cdn', target: 'gw' },
        { id: 'e3', source: 'gw', target: 'lb' },
        { id: 'e4', source: 'lb', target: 'stream' },
        { id: 'e5', source: 'lb', target: 'catalog' },
        { id: 'e6', source: 'stream', target: 'storage' },
        { id: 'e7', source: 'stream', target: 'db' },
        { id: 'e8', source: 'catalog', target: 'db' },
      ],
    },
  },

]

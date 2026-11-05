import type { ComponentType } from '../components/nodes'
import { replicasOf } from './cost'

type Provider = 'aws' | 'gcp' | 'azure'

interface ServicePricing {
  service: string
  monthlyBase: number
  notes: string
}

// ponytail: flat lookup, no per-request/egress tiers - add when backend returns real usage-based pricing
const PRICING: Record<Provider, Partial<Record<ComponentType, ServicePricing>>> = {
  aws: {
    loadBalancer: { service: 'ALB', monthlyBase: 22, notes: 'Application Load Balancer, base + ~$8/LCU' },
    apiGateway: { service: 'API Gateway', monthlyBase: 18, notes: 'HTTP API, ~$1/M requests' },
    service: { service: 'EC2 t3.medium', monthlyBase: 30, notes: '2 vCPU, 4 GB - or Fargate at similar cost' },
    worker: { service: 'EC2 t3.small', monthlyBase: 15, notes: 'Background worker instance' },
    serverless: { service: 'Lambda', monthlyBase: 5, notes: '~$0.20/M invocations + compute' },
    cache: { service: 'ElastiCache t3.medium', monthlyBase: 45, notes: 'Redis, single node' },
    database: { service: 'RDS db.t3.medium', monthlyBase: 50, notes: 'PostgreSQL, single-AZ' },
    dataWarehouse: { service: 'Redshift dc2.large', monthlyBase: 180, notes: 'Single node on-demand' },
    queue: { service: 'SQS', monthlyBase: 8, notes: '~$0.40/M requests' },
    objectStorage: { service: 'S3', monthlyBase: 23, notes: 'Standard, ~1 TB' },
    cdn: { service: 'CloudFront', monthlyBase: 25, notes: '~$0.085/GB first 10 TB' },
    searchIndex: { service: 'OpenSearch t3.medium', monthlyBase: 55, notes: 'Single node' },
    messageBroker: { service: 'MSK', monthlyBase: 175, notes: 'kafka.t3.small, 3 brokers minimum' },
    eventBus: { service: 'EventBridge', monthlyBase: 15, notes: '~$1/M events' },
    monitoring: { service: 'CloudWatch', monthlyBase: 20, notes: 'Dashboards + basic metrics' },
    logging: { service: 'CloudWatch Logs', monthlyBase: 20, notes: '~$0.50/GB ingested' },
    containerOrchestrator: { service: 'EKS', monthlyBase: 73, notes: '$0.10/hr control plane + node costs' },
    autoScalingGroup: { service: 'EC2 ASG', monthlyBase: 30, notes: 'Per instance in the group' },
    waf: { service: 'AWS WAF', monthlyBase: 10, notes: '~$5/web ACL + $1/rule + $0.60/M requests' },
    cronJob: { service: 'EventBridge + Lambda', monthlyBase: 3, notes: 'Scheduled invocation' },
    dns: { service: 'Route 53', monthlyBase: 1, notes: '$0.50/hosted zone + queries' },
    ingress: { service: 'ALB', monthlyBase: 22, notes: 'Same as load balancer' },
    dataLake: { service: 'S3 + Glue', monthlyBase: 150, notes: 'Storage + catalog' },
  },
  gcp: {
    loadBalancer: { service: 'Cloud Load Balancing', monthlyBase: 18, notes: 'Global HTTP(S) LB' },
    apiGateway: { service: 'Apigee / Cloud Endpoints', monthlyBase: 15, notes: 'API management' },
    service: { service: 'Cloud Run', monthlyBase: 25, notes: 'Per-container, auto-scales to zero' },
    worker: { service: 'Cloud Run Jobs', monthlyBase: 15, notes: 'Background processing' },
    serverless: { service: 'Cloud Functions', monthlyBase: 5, notes: '~$0.40/M invocations' },
    cache: { service: 'Memorystore', monthlyBase: 45, notes: 'Redis, basic tier' },
    database: { service: 'Cloud SQL', monthlyBase: 50, notes: 'PostgreSQL, db-f1-micro to db-n1-standard' },
    dataWarehouse: { service: 'BigQuery', monthlyBase: 200, notes: 'Flat-rate slot, ~$5/TB queried on-demand' },
    queue: { service: 'Pub/Sub', monthlyBase: 10, notes: '~$40/M messages at scale' },
    objectStorage: { service: 'Cloud Storage', monthlyBase: 20, notes: 'Standard, ~1 TB' },
    cdn: { service: 'Cloud CDN', monthlyBase: 22, notes: '~$0.08/GB' },
    searchIndex: { service: 'Elastic Cloud on GCP', monthlyBase: 55, notes: 'Managed Elasticsearch' },
    messageBroker: { service: 'Pub/Sub', monthlyBase: 35, notes: 'Streaming mode' },
    eventBus: { service: 'Eventarc', monthlyBase: 12, notes: 'Event routing' },
    monitoring: { service: 'Cloud Monitoring', monthlyBase: 15, notes: 'Free tier generous, paid at scale' },
    logging: { service: 'Cloud Logging', monthlyBase: 15, notes: '~$0.50/GB after 50 GB free' },
    containerOrchestrator: { service: 'GKE Autopilot', monthlyBase: 65, notes: 'Cluster mgmt + pod costs' },
    autoScalingGroup: { service: 'MIG', monthlyBase: 25, notes: 'Managed instance group, per VM' },
    waf: { service: 'Cloud Armor', monthlyBase: 10, notes: '$5/policy + $1/rule' },
    cronJob: { service: 'Cloud Scheduler', monthlyBase: 2, notes: '$0.10/job/month' },
    dns: { service: 'Cloud DNS', monthlyBase: 1, notes: '$0.20/zone' },
    ingress: { service: 'Cloud Load Balancing', monthlyBase: 18, notes: 'Ingress controller' },
    dataLake: { service: 'Cloud Storage + Dataproc', monthlyBase: 160, notes: 'Object storage + processing' },
  },
  azure: {
    loadBalancer: { service: 'Application Gateway', monthlyBase: 22, notes: 'Standard v2' },
    apiGateway: { service: 'API Management', monthlyBase: 15, notes: 'Consumption tier' },
    service: { service: 'App Service B1', monthlyBase: 13, notes: '1 vCPU, 1.75 GB' },
    worker: { service: 'App Service B1', monthlyBase: 13, notes: 'WebJob or separate plan' },
    serverless: { service: 'Azure Functions', monthlyBase: 5, notes: '~$0.20/M executions' },
    cache: { service: 'Azure Cache for Redis', monthlyBase: 40, notes: 'Basic C0' },
    database: { service: 'Azure SQL', monthlyBase: 50, notes: 'Basic/Standard tier' },
    dataWarehouse: { service: 'Synapse Analytics', monthlyBase: 200, notes: 'Serverless pool' },
    queue: { service: 'Service Bus', monthlyBase: 10, notes: 'Basic tier' },
    objectStorage: { service: 'Blob Storage', monthlyBase: 20, notes: 'Hot tier, ~1 TB' },
    cdn: { service: 'Azure CDN', monthlyBase: 20, notes: '~$0.08/GB' },
    searchIndex: { service: 'Azure AI Search', monthlyBase: 55, notes: 'Basic tier' },
    messageBroker: { service: 'Event Hubs', monthlyBase: 30, notes: 'Standard tier' },
    eventBus: { service: 'Event Grid', monthlyBase: 10, notes: '~$0.60/M operations' },
    monitoring: { service: 'Azure Monitor', monthlyBase: 20, notes: 'Basic metrics + alerts' },
    logging: { service: 'Log Analytics', monthlyBase: 20, notes: '~$2.76/GB ingested' },
    containerOrchestrator: { service: 'AKS', monthlyBase: 60, notes: 'Free control plane, node costs only' },
    autoScalingGroup: { service: 'VMSS', monthlyBase: 25, notes: 'VM Scale Set, per instance' },
    waf: { service: 'Azure WAF', monthlyBase: 12, notes: '$5/gateway hour + $1/rule' },
    cronJob: { service: 'Logic Apps', monthlyBase: 3, notes: 'Consumption plan' },
    dns: { service: 'Azure DNS', monthlyBase: 1, notes: '$0.50/zone' },
    ingress: { service: 'Application Gateway', monthlyBase: 22, notes: 'Ingress controller' },
    dataLake: { service: 'ADLS Gen2', monthlyBase: 170, notes: 'Data Lake Storage' },
  },
}

const ZERO_COST_TYPES: ComponentType[] = ['client', 'mobile', 'webBrowser', 'desktopApp', 'apiClient', 'customClient', 'thirdPartyApi', 'paymentGateway', 'webhook']

export interface ProviderEstimate {
  provider: Provider
  providerName: string
  total: number
  breakdown: { nodeType: string; service: string; cost: number; notes: string; replicas: number }[]
}

const PROVIDER_NAMES: Record<Provider, string> = { aws: 'AWS', gcp: 'Google Cloud', azure: 'Microsoft Azure' }

export function estimateProviderCost(
  provider: Provider,
  nodes: { type: string; config?: Record<string, unknown>; replicas?: number }[],
): ProviderEstimate {
  const catalog = PRICING[provider]
  const breakdown: ProviderEstimate['breakdown'] = []

  for (const node of nodes) {
    const ct = node.type as ComponentType
    if (ZERO_COST_TYPES.includes(ct)) continue
    const entry = catalog[ct]
    const replicas = replicasOf(ct, node.config, node.replicas)
    if (entry) {
      breakdown.push({ nodeType: ct, service: entry.service, cost: entry.monthlyBase * replicas, notes: entry.notes, replicas })
    } else {
      breakdown.push({ nodeType: ct, service: 'General compute', cost: 20 * replicas, notes: 'No specific mapping - generic estimate', replicas })
    }
  }

  return { provider, providerName: PROVIDER_NAMES[provider], total: breakdown.reduce((s, b) => s + b.cost, 0), breakdown }
}

export function estimateAllProviders(
  nodes: { type: string; config?: Record<string, unknown>; replicas?: number }[],
): { aws: ProviderEstimate; gcp: ProviderEstimate; azure: ProviderEstimate; cheapest: Provider } {
  const aws = estimateProviderCost('aws', nodes)
  const gcp = estimateProviderCost('gcp', nodes)
  const azure = estimateProviderCost('azure', nodes)
  const cheapest = aws.total <= gcp.total && aws.total <= azure.total ? 'aws' : gcp.total <= azure.total ? 'gcp' : 'azure'
  return { aws, gcp, azure, cheapest }
}

import type { SVGProps } from 'react'

const base: SVGProps<SVGSVGElement> = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function ClientIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" />
    </svg>
  )
}

export function LoadBalancerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="2.3" />
      <path d="M12 4.5v5.2M12 14.3v5.2M12 4.5 6 8M12 4.5l6 3.5M12 19.5 6 16M12 19.5l6-3.5" />
    </svg>
  )
}

export function GatewayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 4 6.5v5c0 5 3.4 7.9 8 9.5 4.6-1.6 8-4.5 8-9.5v-5L12 3Z" />
    </svg>
  )
}

export function ServiceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Z" />
    </svg>
  )
}

export function CacheIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M13 3 5 13.5h6L11 21l8-10.5h-6L13 3Z" />
    </svg>
  )
}

export function DatabaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="12" cy="6" rx="7" ry="2.8" />
      <path d="M5 6v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6" />
      <path d="M5 12v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6" />
    </svg>
  )
}

export function QueueIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="7" width="4" height="10" rx="1" />
      <rect x="10" y="4.5" width="4" height="15" rx="1" />
      <rect x="16.5" y="9" width="4" height="8" rx="1" />
    </svg>
  )
}

export function AutoScalingGroupIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="10" height="10" rx="1" />
      <rect x="8" y="8" width="10" height="10" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  )
}

export function MobileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18.2h2" />
    </svg>
  )
}

export function WebBrowserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M3 8.5h18" />
      <circle cx="6" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function DnsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 6 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-6-3.8-9s1.3-6.5 3.8-9Z" />
    </svg>
  )
}

export function CdnIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="4" r="1.4" />
      <circle cx="19.5" cy="16" r="1.4" />
      <circle cx="4.5" cy="16" r="1.4" />
      <path d="M12 7v2M17.4 15 14.5 13.3M6.6 15l2.9-1.7" />
    </svg>
  )
}

export function WafIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 4 6.5v5c0 5 3.4 7.9 8 9.5 4.6-1.6 8-4.5 8-9.5v-5L12 3Z" />
      <path d="M9 12.5 11 14.5 15.5 9.5" />
    </svg>
  )
}

export function IngressIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5h6M4 12h10M4 19h16" />
      <path d="M16 5h4v4M16 9l4-4" />
    </svg>
  )
}

export function WorkerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h6v6H9z" />
    </svg>
  )
}

export function ServerlessIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M13 3 5 13.5h6L11 21l8-10.5h-6L13 3Z" />
      <circle cx="12" cy="12" r="9.5" strokeDasharray="2 3" />
    </svg>
  )
}

export function DataWarehouseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 21V9l8-6 8 6v12" />
      <path d="M4 21h16M9 21v-7h6v7" />
    </svg>
  )
}

export function LightningIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M13 3 5 13.5h6L11 21l8-10.5h-6L13 3Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SkullIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="10.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10.5" r="1.2" fill="currentColor" stroke="none" />
      <path d="M6 11c0-3.9 2.7-7 6-7s6 3.1 6 7c0 2-1 3.7-2.3 4.8v2.7h-1.4v-1.7h-1v1.7h-1v-1.7h-1v1.7h-1.4v-2.7C7 14.7 6 13 6 11Z" />
    </svg>
  )
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

export function ThrottleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 18 9 8l4 6 3-5 4 9" />
    </svg>
  )
}

export function PacketDropIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6h16M4 12h10M4 18h7" />
      <path d="M18 14v7M15 18l3 3 3-3" />
    </svg>
  )
}

export function IotIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="8" y="8" width="8" height="8" rx="1.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 5l-2 2M5 19l2-2M17 19l-2-2" />
    </svg>
  )
}

export function ContainerOrchestratorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 5 6.5v6.5l7 3.5 7-3.5V6.5L12 3Z" />
      <path d="M12 3v10M5 6.5l7 3.5 7-3.5" />
      <path d="M12 13v8" />
    </svg>
  )
}

export function CronJobIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9v4l2.5 1.5" />
      <path d="M9 3h6" />
    </svg>
  )
}

export function ObjectStorageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  )
}

export function SearchIndexIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M19.5 19.5 15 15" />
    </svg>
  )
}

export function DataLakeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3 15c1.8 2 4 3 9 3s7.2-1 9-3" />
      <path d="M3 10c1.8 2 4 3 9 3s7.2-1 9-3" />
      <path d="M4.5 6.5 12 3l7.5 3.5-7.5 3.5-7.5-3.5Z" />
    </svg>
  )
}

export function MessageBrokerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="6" cy="6" r="2.3" />
      <circle cx="18" cy="6" r="2.3" />
      <circle cx="12" cy="18" r="2.3" />
      <path d="M7.7 7.3 10.5 16M16.3 7.3 13.5 16M8.3 6h7.4" />
    </svg>
  )
}

export function EventBusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12h18" />
      <circle cx="7" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="13" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function WebhookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M7 17.5a4 4 0 1 1 2.3-7.3" />
      <path d="M12 4.5a4 4 0 0 1 3.6 5.7" />
      <path d="M18 12.5a4 4 0 1 1-3.6 6.9" />
      <circle cx="9" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="18" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function MonitoringIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3 17h3l3-9 4 13 3-9h5" />
    </svg>
  )
}

export function LoggingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M7.5 8h9M7.5 12h9M7.5 16h5" />
    </svg>
  )
}

export function ThirdPartyApiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M3 11h18" />
      <path d="M7 15h.01M11 15h.01" />
    </svg>
  )
}

export function PaymentGatewayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 9.5h18" />
      <path d="M6.5 14.5h4" />
    </svg>
  )
}

export const COMPONENT_ICONS = {
  client: ClientIcon,
  mobile: MobileIcon,
  webBrowser: WebBrowserIcon,
  dns: DnsIcon,
  cdn: CdnIcon,
  loadBalancer: LoadBalancerIcon,
  apiGateway: GatewayIcon,
  waf: WafIcon,
  ingress: IngressIcon,
  service: ServiceIcon,
  worker: WorkerIcon,
  serverless: ServerlessIcon,
  queue: QueueIcon,
  autoScalingGroup: AutoScalingGroupIcon,
  cache: CacheIcon,
  database: DatabaseIcon,
  dataWarehouse: DataWarehouseIcon,
  iotDevice: IotIcon,
  containerOrchestrator: ContainerOrchestratorIcon,
  cronJob: CronJobIcon,
  objectStorage: ObjectStorageIcon,
  searchIndex: SearchIndexIcon,
  dataLake: DataLakeIcon,
  messageBroker: MessageBrokerIcon,
  eventBus: EventBusIcon,
  webhook: WebhookIcon,
  monitoring: MonitoringIcon,
  logging: LoggingIcon,
  thirdPartyApi: ThirdPartyApiIcon,
  paymentGateway: PaymentGatewayIcon,
} as const

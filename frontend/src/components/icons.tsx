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

export const COMPONENT_ICONS = {
  client: ClientIcon,
  loadBalancer: LoadBalancerIcon,
  apiGateway: GatewayIcon,
  service: ServiceIcon,
  cache: CacheIcon,
  database: DatabaseIcon,
  queue: QueueIcon,
  autoScalingGroup: AutoScalingGroupIcon,
} as const

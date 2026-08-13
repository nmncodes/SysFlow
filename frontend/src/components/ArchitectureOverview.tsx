import { useMemo } from 'react'
import {
  Position,
  getBezierPath,
  type Edge,
  type Node,
} from 'reactflow'

import type { ArchNodeData } from './ArchNode'
import { COMPONENT_ICONS } from './icons'
import { COMPONENT_LIBRARY } from './nodes'

interface ArchitectureOverviewProps {
  nodes: Node<ArchNodeData>[]
  edges: Edge[]
}

const DEFAULT_NODE_WIDTH = 136
const DEFAULT_NODE_HEIGHT = 94

const VIEW_WIDTH = 280
const VIEW_HEIGHT = 190
const PADDING = 40

// Color mapping for component types (matches Canvas MiniMap)
function getComponentColor(componentType: string): string {
  switch (componentType) {
    // Client
    case 'client':
    case 'mobile':
    case 'webBrowser':
      return '#8b5cf6'

    // Traffic & Edge
    case 'dns':
    case 'cdn':
    case 'loadBalancer':
    case 'apiGateway':
    case 'waf':
    case 'ingress':
      return '#3b82f6'

    // Compute
    case 'service':
    case 'worker':
    case 'serverless':
    case 'autoScalingGroup':
    case 'queue':
      return '#22c55e'

    // Data
    case 'cache':
      return '#f59e0b'

    case 'database':
    case 'dataWarehouse':
      return '#ef4444'

    default:
      return '#71717a'
  }
}

export default function ArchitectureOverview({
  nodes,
  edges,
}: ArchitectureOverviewProps) {
  const layout = useMemo(() => {
    if (nodes.length === 0) {
      return null
    }

    const nodeRects = nodes.map((node) => ({
      node,
      x: node.position.x,
      y: node.position.y,
      width: node.width ?? DEFAULT_NODE_WIDTH,
      height: node.height ?? DEFAULT_NODE_HEIGHT,
    }))

    const minX = Math.min(...nodeRects.map((item) => item.x))
    const minY = Math.min(...nodeRects.map((item) => item.y))

    const maxX = Math.max(
      ...nodeRects.map((item) => item.x + item.width),
    )

    const maxY = Math.max(
      ...nodeRects.map((item) => item.y + item.height),
    )

    const graphWidth = Math.max(maxX - minX, 1)
    const graphHeight = Math.max(maxY - minY, 1)

    const scale = Math.min(
      (VIEW_WIDTH - PADDING * 2) / graphWidth,
      (VIEW_HEIGHT - PADDING * 2) / graphHeight,
    )

    const offsetX =
      (VIEW_WIDTH - graphWidth * scale) / 2 - minX * scale

    const offsetY =
      (VIEW_HEIGHT - graphHeight * scale) / 2 - minY * scale

    return {
      nodeRects,
      scale,
      offsetX,
      offsetY,
    }
  }, [nodes])

  if (!layout) {
    return null
  }

  const getNodeRect = (nodeId: string) => {
    return layout.nodeRects.find((item) => item.node.id === nodeId)
  }

  return (
    <div
      className="absolute bottom-4 right-4 z-10 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-md"
      style={{
        width: VIEW_WIDTH,
        height: VIEW_HEIGHT,
      }}
    >
      <svg
        width={VIEW_WIDTH}
        height={VIEW_HEIGHT}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="block"
      >
        {/* Background */}
        <rect
          x={0}
          y={0}
          width={VIEW_WIDTH}
          height={VIEW_HEIGHT}
          fill="white"
        />

        {/* Connections */}
        <g>
          {edges.map((edge) => {
            const source = getNodeRect(edge.source)
            const target = getNodeRect(edge.target)

            if (!source || !target) {
              return null
            }

            const sourceX =
              (source.x + source.width) * layout.scale +
              layout.offsetX

            const sourceY =
              (source.y + source.height / 2) * layout.scale +
              layout.offsetY

            const targetX =
              target.x * layout.scale +
              layout.offsetX

            const targetY =
              (target.y + target.height / 2) * layout.scale +
              layout.offsetY

            const [path] = getBezierPath({
              sourceX,
              sourceY,
              sourcePosition: Position.Right,
              targetX,
              targetY,
              targetPosition: Position.Left,
            })

            return (
              <path
                key={edge.id}
                d={path}
                fill="none"
                stroke="#c4b5fd"
                strokeWidth={Math.max(1, 2 * layout.scale)}
                strokeLinecap="round"
              />
            )
          })}
        </g>

        {/* Nodes */}
        <g>
          {layout.nodeRects.map(
            ({ node, x, y, width, height }) => {
              const data = node.data
              const componentColor = getComponentColor(data.componentType)

              const scaledX =
                x * layout.scale + layout.offsetX

              const scaledY =
                y * layout.scale + layout.offsetY

              const scaledWidth = width * layout.scale
              const scaledHeight = height * layout.scale

              const Icon =
                COMPONENT_ICONS[
                  data.componentType as keyof typeof COMPONENT_ICONS
                ]

              const definition = COMPONENT_LIBRARY.find(
                (component) =>
                  component.type === data.componentType,
              )

              const iconSize = Math.max(
                7,
                Math.min(16, scaledHeight * 0.25),
              )

              const titleSize = Math.max(
                5,
                Math.min(9, scaledHeight * 0.14),
              )

              return (
                <g key={node.id}>
                  {/* Node card */}
                  <rect
                    x={scaledX}
                    y={scaledY}
                    width={scaledWidth}
                    height={scaledHeight}
                    rx={Math.min(10, scaledWidth * 0.12)}
                    fill="white"
                    stroke="#d4d4d8"
                    strokeWidth={1}
                  />

                  {/* Small top accent - component-type-specific color */}
                  <rect
                    x={scaledX}
                    y={scaledY}
                    width={scaledWidth}
                    height={Math.max(2, scaledHeight * 0.08)}
                    rx={Math.min(10, scaledWidth * 0.12)}
                    fill={componentColor}
                  />

                  {/* Icon */}
                  {Icon && (
                    <Icon
                      width={iconSize}
                      height={iconSize}
                      x={
                        scaledX +
                        scaledWidth / 2 -
                        iconSize / 2
                      }
                      y={
                        scaledY +
                        scaledHeight * 0.24
                      }
                      color={componentColor}
                      stroke={componentColor}
                    />
                  )}

                  {/* Node label */}
                  {scaledWidth >= 30 &&
                    scaledHeight >= 25 && (
                      <text
                        x={scaledX + scaledWidth / 2}
                        y={
                          scaledY +
                          scaledHeight * 0.68
                        }
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={titleSize}
                        fontWeight="600"
                        fill="#27272a"
                      >
                        {data.label.length > 14
                          ? `${data.label.slice(0, 13)}…`
                          : data.label}
                      </text>
                    )}

                  {/* Component type */}
                  {scaledWidth >= 40 &&
                    scaledHeight >= 35 && (
                      <text
                        x={scaledX + scaledWidth / 2}
                        y={
                          scaledY +
                          scaledHeight * 0.84
                        }
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={Math.max(
                          4,
                          titleSize * 0.7,
                        )}
                        fill="#a1a1aa"
                      >
                        {definition?.label ?? ''}
                      </text>
                    )}
                </g>
              )
            },
          )}
        </g>
      </svg>
    </div>
  )
}
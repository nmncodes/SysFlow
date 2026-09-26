import { useMemo, useState } from 'react'
import {
  Position,
  getBezierPath,
  type Edge,
  type Node,
} from 'reactflow'

import type { ArchNodeData } from './ArchNode'
import { COMPONENT_ICONS } from './icons'
import { COMPONENT_LIBRARY } from './nodes'
import { useTheme } from '../lib/theme'

interface ArchitectureOverviewProps {
  nodes: Node<ArchNodeData>[]
  edges: Edge[]
}

const DEFAULT_NODE_WIDTH = 136
const DEFAULT_NODE_HEIGHT = 94

const VIEW_WIDTH = 220
const VIEW_HEIGHT = 150
const HEADER_HEIGHT = 34
const DRAW_HEIGHT = VIEW_HEIGHT - HEADER_HEIGHT
const PADDING = 22
// A single (or few, clustered) node has almost no bounding-box spread, so an unbounded scale
// would blow it up to fill the whole minimap and visually crowd the header above it.
const MAX_SCALE = 0.9

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
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [isMinimized, setIsMinimized] = useState(() => {
    try {
      return localStorage.getItem('sysflow:minimap_minimized') === 'true'
    } catch {
      return false
    }
  })

  const toggleMinimized = () => {
    setIsMinimized((prev) => {
      const next = !prev
      try {
        localStorage.setItem('sysflow:minimap_minimized', String(next))
      } catch {
        // ignore
      }
      return next
    })
  }

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
      (DRAW_HEIGHT - PADDING * 2) / graphHeight,
      MAX_SCALE,
    )

    const offsetX =
      (VIEW_WIDTH - graphWidth * scale) / 2 - minX * scale

    const offsetY =
      (DRAW_HEIGHT - graphHeight * scale) / 2 - minY * scale

    return {
      nodeRects,
      scale,
      offsetX,
      offsetY,
    }
  }, [nodes])

  const getNodeRect = (nodeId: string) => {
    if (!layout) return undefined
    return layout.nodeRects.find((item) => item.node.id === nodeId)
  }

  return (
    <div
      className={`sysflow-minimap absolute z-10 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg transition-all duration-200 ${
        isMinimized ? 'cursor-pointer select-none is-minimized' : ''
      }`}
      style={{
        width: isMinimized ? 38 : VIEW_WIDTH,
        height: isMinimized ? 118 : VIEW_HEIGHT,
      }}
      onClick={isMinimized ? toggleMinimized : undefined}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          toggleMinimized()
        }}
        title={isMinimized ? 'Expand minimap' : 'Minimize minimap'}
        aria-label={isMinimized ? 'Expand minimap' : 'Minimize minimap'}
        className="sysflow-minimap-toggle"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {isMinimized ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
        </svg>
      </button>

      {!isMinimized && (
        <>
          <div className="sysflow-minimap-header">
            <div className="flex items-center gap-1.5 pl-6">
              <span className="sysflow-minimap-dot" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Minimap</span>
            </div>
            <span className="text-[9px] text-zinc-300">Architecture overview</span>
          </div>
          <svg
        width={VIEW_WIDTH}
        height={DRAW_HEIGHT}
        viewBox={`0 0 ${VIEW_WIDTH} ${DRAW_HEIGHT}`}
        className="block"
      >
        {layout ? (
          <>
        {/* Background */}
        <rect
          x={0}
          y={0}
          width={VIEW_WIDTH}
          height={DRAW_HEIGHT}
          fill={isDark ? '#18181b' : '#fbfeff'}
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
                    fill={isDark ? '#232326' : 'white'}
                    stroke={isDark ? '#3f3f46' : '#d4d4d8'}
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
                        fill={isDark ? '#f4f4f5' : '#27272a'}
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
                        fill={isDark ? '#71717a' : '#a1a1aa'}
                      >
                        {definition?.label ?? ''}
                      </text>
                    )}
                </g>
              )
            },
          )}
        </g>
          </>
        ) : (
          <text
            x={VIEW_WIDTH / 2}
            y={DRAW_HEIGHT / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="9"
            fontWeight="600"
            fill={isDark ? '#71717a' : '#a1a1aa'}
          >
            No components
          </text>
        )}
          </svg>
        </>
      )}
    </div>
  )
}
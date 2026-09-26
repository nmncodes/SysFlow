import { useCallback, useEffect, useRef, useState } from 'react'
import type { Edge, Node } from 'reactflow'
import type { ArchNodeData } from '../components/ArchNode'

interface Snapshot {
  nodes: Node<ArchNodeData>[]
  edges: Edge[]
}

const DEBOUNCE_MS = 500

/**
 * Debounced undo/redo: checkpoints are taken ~500ms after activity settles,
 * so a drag or a burst of edits collapses into one undo step instead of
 * flooding the stack with every intermediate position.
 */
export function useHistory(
  nodes: Node<ArchNodeData>[],
  edges: Edge[],
  setNodes: (n: Node<ArchNodeData>[]) => void,
  setEdges: (e: Edge[]) => void,
) {
  const past = useRef<Snapshot[]>([])
  const future = useRef<Snapshot[]>([])
  const lastCommitted = useRef<Snapshot>({ nodes, edges })
  const timerRef = useRef<number | null>(null)
  const suppressNext = useRef(false)
  const [, forceRender] = useState(0)

  useEffect(() => {
    if (suppressNext.current) {
      suppressNext.current = false
      lastCommitted.current = { nodes, edges }
      return
    }
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      past.current.push(lastCommitted.current)
      if (past.current.length > 50) past.current.shift()
      future.current = []
      lastCommitted.current = { nodes, edges }
      forceRender((v) => v + 1)
    }, DEBOUNCE_MS)
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  const undo = useCallback(() => {
    if (past.current.length === 0) return
    const previous = past.current.pop()!
    future.current.push(lastCommitted.current)
    suppressNext.current = true
    lastCommitted.current = previous
    setNodes(previous.nodes)
    setEdges(previous.edges)
    forceRender((v) => v + 1)
  }, [setNodes, setEdges])

  const redo = useCallback(() => {
    if (future.current.length === 0) return
    const next = future.current.pop()!
    past.current.push(lastCommitted.current)
    suppressNext.current = true
    lastCommitted.current = next
    setNodes(next.nodes)
    setEdges(next.edges)
    forceRender((v) => v + 1)
  }, [setNodes, setEdges])

  return { undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 }
}

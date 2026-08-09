package dev.sysflow.simulation.model;

import java.util.*;

/**
 * Immutable view over a user-drawn architecture graph, with adjacency
 * helpers the simulation engine needs. Assumes the graph is a DAG from
 * Client nodes downward — cycles (e.g. retry loops) are out of scope for
 * the MVP tick-based model (see docs/02-ARCHITECTURE.md §4).
 */
public class SimulationGraph {

    private final Map<String, GraphNode> nodesById;
    private final List<GraphEdge> edges;
    private final Map<String, List<GraphEdge>> outgoingByNode;
    private final Map<String, List<GraphEdge>> incomingByNode;

    public SimulationGraph(List<GraphNode> nodes, List<GraphEdge> edges) {
        this.nodesById = new LinkedHashMap<>();
        for (GraphNode n : nodes) nodesById.put(n.id(), n);
        this.edges = List.copyOf(edges);

        this.outgoingByNode = new HashMap<>();
        this.incomingByNode = new HashMap<>();
        for (GraphEdge e : edges) {
            outgoingByNode.computeIfAbsent(e.source(), k -> new ArrayList<>()).add(e);
            incomingByNode.computeIfAbsent(e.target(), k -> new ArrayList<>()).add(e);
        }
    }

    public Collection<GraphNode> nodes() {
        return nodesById.values();
    }

    public GraphNode node(String id) {
        return nodesById.get(id);
    }

    public List<GraphEdge> outgoing(String nodeId) {
        return outgoingByNode.getOrDefault(nodeId, List.of());
    }

    public List<GraphEdge> incoming(String nodeId) {
        return incomingByNode.getOrDefault(nodeId, List.of());
    }

    public List<GraphNode> clientNodes() {
        return nodesById.values().stream().filter(n -> "client".equals(n.type())).toList();
    }

    /** Topological order (Kahn's algorithm). Nodes involved in a cycle are appended at the end. */
    public List<GraphNode> topologicalOrder() {
        Map<String, Integer> inDegree = new HashMap<>();
        for (GraphNode n : nodesById.values()) inDegree.put(n.id(), incoming(n.id()).size());

        Deque<String> queue = new ArrayDeque<>();
        inDegree.forEach((id, deg) -> {
            if (deg == 0) queue.add(id);
        });

        List<GraphNode> order = new ArrayList<>();
        Set<String> visited = new HashSet<>();
        while (!queue.isEmpty()) {
            String id = queue.poll();
            if (!visited.add(id)) continue;
            order.add(nodesById.get(id));
            for (GraphEdge e : outgoing(id)) {
                int updated = inDegree.merge(e.target(), -1, Integer::sum);
                if (updated == 0) queue.add(e.target());
            }
        }
        // Anything left (cycles) — append in original insertion order so the engine doesn't drop nodes.
        for (GraphNode n : nodesById.values()) {
            if (!visited.contains(n.id())) order.add(n);
        }
        return order;
    }
}

package dev.sysflow.srs;

import dev.sysflow.simulation.model.GraphEdge;
import dev.sysflow.simulation.model.GraphNode;
import dev.sysflow.simulation.model.SimulationGraph;
import dev.sysflow.srs.dto.SrsImportResponse;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Simple left-to-right layered layout: a node's column is one past the
 * deepest of its predecessors, so request flow reads left-to-right the
 * same way every hand-built template in lib/templates.ts does.
 */
@Component
public class GraphLayout {

    private static final double COLUMN_WIDTH = 260;
    private static final double ROW_HEIGHT = 150;

    public Map<String, SrsImportResponse.Position> layout(SimulationGraph graph) {
        Map<String, Integer> depth = new HashMap<>();
        for (GraphNode node : graph.topologicalOrder()) {
            int d = 0;
            for (GraphEdge incoming : graph.incoming(node.id())) {
                d = Math.max(d, depth.getOrDefault(incoming.source(), 0) + 1);
            }
            depth.put(node.id(), d);
        }

        Map<Integer, Integer> countPerColumn = new HashMap<>();
        Map<String, SrsImportResponse.Position> positions = new HashMap<>();
        for (GraphNode node : graph.nodes()) {
            int column = depth.getOrDefault(node.id(), 0);
            int row = countPerColumn.merge(column, 1, Integer::sum) - 1;
            positions.put(node.id(), new SrsImportResponse.Position(40 + column * COLUMN_WIDTH, 40 + row * ROW_HEIGHT));
        }
        return positions;
    }
}

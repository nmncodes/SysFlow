package dev.sysflow.ai;

import dev.sysflow.ai.dto.AnalyzeRequest;
import dev.sysflow.ai.dto.Finding;
import dev.sysflow.simulation.model.GraphEdge;
import dev.sysflow.simulation.model.GraphNode;
import dev.sysflow.simulation.model.SimulationGraph;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Implements the /api/ai/analyze contract from docs/04-DATA-MODEL-AND-API.md
 * as the two-stage pipeline described in docs/02-ARCHITECTURE.md §5:
 * deterministic RuleEngine facts, optionally rewritten/prioritized by
 * GeminiClient. Always returns something useful even with no Gemini key.
 */
@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final RuleEngine ruleEngine;
    private final GeminiClient geminiClient;

    public AiController(RuleEngine ruleEngine, GeminiClient geminiClient) {
        this.ruleEngine = ruleEngine;
        this.geminiClient = geminiClient;
    }

    @PostMapping("/analyze")
    public Map<String, Object> analyze(@RequestBody AnalyzeRequest request) {
        List<GraphNode> nodes = request.graphJson().nodes().stream()
                .map(n -> new GraphNode(n.id(), n.type(), n.config()))
                .toList();
        List<GraphEdge> edges = request.graphJson().edges().stream()
                .map(e -> new GraphEdge(e.id(), e.source(), e.target()))
                .toList();
        SimulationGraph graph = new SimulationGraph(nodes, edges);

        List<Finding> ruleFindings = ruleEngine.analyze(graph);
        List<Finding> findings = geminiClient.synthesize(ruleFindings);

        return Map.of("findings", findings, "aiEnabled", geminiClient.isEnabled());
    }
}

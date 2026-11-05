package dev.sysflow.ai;

import dev.sysflow.ai.dto.Finding;
import dev.sysflow.common.CostModel;
import dev.sysflow.simulation.model.GraphEdge;
import dev.sysflow.simulation.model.GraphNode;
import dev.sysflow.simulation.model.SimulationGraph;
import dev.sysflow.srs.ComponentTypes;
import dev.sysflow.srs.GraphLayout;
import dev.sysflow.srs.SrsGraphExtractor;
import dev.sysflow.srs.dto.RawExtraction;
import dev.sysflow.srs.dto.SrsImportResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ai")
public class GenerateArchitectureController {

    private final SrsGraphExtractor graphExtractor;
    private final GraphLayout graphLayout;
    private final RuleEngine ruleEngine;
    private final GeminiClient geminiClient;
    private final CostModel costModel;

    public GenerateArchitectureController(
            SrsGraphExtractor graphExtractor,
            GraphLayout graphLayout,
            RuleEngine ruleEngine,
            GeminiClient geminiClient,
            CostModel costModel
    ) {
        this.graphExtractor = graphExtractor;
        this.graphLayout = graphLayout;
        this.ruleEngine = ruleEngine;
        this.geminiClient = geminiClient;
        this.costModel = costModel;
    }

    public record GenerateRequest(String description) {}

    @PostMapping("/generate")
    public SrsImportResponse generate(@RequestBody GenerateRequest request) {
        if (request.description() == null || request.description().isBlank()) {
            throw new IllegalArgumentException("Description is required.");
        }
        if (request.description().length() > 5000) {
            throw new IllegalArgumentException("Description must be under 5000 characters.");
        }

        RawExtraction extraction = graphExtractor.generateFromDescription(request.description());
        Set<String> unrecognized = graphExtractor.unrecognizedTerms(extraction);

        Map<String, Map<String, Object>> configsById = extraction.nodes().stream()
                .collect(Collectors.toMap(RawExtraction.RawNode::id, this::toConfig, (a, b) -> a));

        List<GraphNode> nodes = extraction.nodes().stream()
                .map(n -> new GraphNode(
                        n.id(),
                        ComponentTypes.VALID_TYPES.contains(n.type()) ? n.type() : ComponentTypes.FALLBACK_TYPE,
                        configsById.getOrDefault(n.id(), Map.of())))
                .toList();
        List<GraphEdge> edges = extraction.edges().stream()
                .map(e -> new GraphEdge(e.source() + "__" + e.target(), e.source(), e.target()))
                .toList();
        SimulationGraph graph = new SimulationGraph(nodes, edges);

        Map<String, SrsImportResponse.Position> positions = graphLayout.layout(graph);
        Map<String, String> labelsById = extraction.nodes().stream()
                .collect(Collectors.toMap(RawExtraction.RawNode::id, n -> n.label() != null ? n.label() : n.id(), (a, b) -> a));

        List<SrsImportResponse.NodeJson> nodeJsons = nodes.stream()
                .map(n -> new SrsImportResponse.NodeJson(
                        n.id(), n.type(), labelsById.getOrDefault(n.id(), n.id()), n.config(),
                        positions.getOrDefault(n.id(), new SrsImportResponse.Position(40, 40))))
                .toList();
        List<SrsImportResponse.EdgeJson> edgeJsons = edges.stream()
                .map(e -> new SrsImportResponse.EdgeJson(e.id(), e.source(), e.target()))
                .toList();

        List<Finding> ruleFindings = ruleEngine.analyze(graph);
        Map<String, Double> nodeCostsById = nodes.stream()
                .collect(Collectors.toMap(GraphNode::id, costModel::monthlyCostOf));
        List<Finding> findings = geminiClient.synthesize(ruleFindings, nodeCostsById);
        double totalMonthlyCost = nodes.stream().mapToDouble(costModel::monthlyCostOf).sum();

        return new SrsImportResponse(
                new SrsImportResponse.GraphJson(nodeJsons, edgeJsons),
                findings,
                geminiClient.isEnabled(),
                unrecognized.stream().sorted().toList(),
                totalMonthlyCost
        );
    }

    private static final Set<String> REPLICA_TYPES = Set.of("database", "searchIndex");

    private Map<String, Object> toConfig(RawExtraction.RawNode node) {
        Map<String, Object> config = new HashMap<>();
        if (REPLICA_TYPES.contains(node.type()) && node.replicaCount() != null) {
            config.put("replicaCount", node.replicaCount());
        }
        if ("cache".equals(node.type()) && node.cacheHitRatePct() != null) {
            config.put("hitRatePct", node.cacheHitRatePct());
        }
        String capacityKey = capacityConfigKey(node.type());
        if (capacityKey != null && node.capacityHint() != null) {
            config.put(capacityKey, node.capacityHint());
        }
        return config;
    }

    // ponytail: duplicated from SrsController - extract to shared util if a third caller appears
    private String capacityConfigKey(String type) {
        return switch (type) {
            case "cdn", "loadBalancer", "waf", "ingress", "queue", "objectStorage",
                 "messageBroker", "eventBus", "webhook", "monitoring", "logging",
                 "thirdPartyApi", "paymentGateway" -> "maxThroughput";
            case "apiGateway" -> "rateLimit";
            case "service", "worker", "serverless", "cronJob" -> "maxConcurrency";
            case "autoScalingGroup", "containerOrchestrator" -> "baseCapacityPerReplica";
            case "database", "dataWarehouse", "searchIndex", "dataLake" -> "maxConnections";
            default -> null;
        };
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadInput(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleGenerationFailure(IllegalStateException e) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", e.getMessage()));
    }
}

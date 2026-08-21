package dev.sysflow.srs;

import dev.sysflow.ai.GeminiClient;
import dev.sysflow.ai.RuleEngine;
import dev.sysflow.ai.dto.Finding;
import dev.sysflow.simulation.model.GraphEdge;
import dev.sysflow.simulation.model.GraphNode;
import dev.sysflow.simulation.model.SimulationGraph;
import dev.sysflow.srs.dto.RawExtraction;
import dev.sysflow.srs.dto.SrsImportResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * POST /api/srs/import — upload an SRS/requirements document, get back an
 * auto-generated architecture graph (ready to drop into the editor, same
 * shape as a saved project) plus trade-off findings from the same rule
 * engine + Gemini pipeline the "Analyze" button uses.
 */
@RestController
@RequestMapping("/api/srs")
public class SrsController {

    private final TextExtractor textExtractor;
    private final SrsGraphExtractor graphExtractor;
    private final GraphLayout graphLayout;
    private final RuleEngine ruleEngine;
    private final GeminiClient geminiClient;

    public SrsController(
            TextExtractor textExtractor,
            SrsGraphExtractor graphExtractor,
            GraphLayout graphLayout,
            RuleEngine ruleEngine,
            GeminiClient geminiClient
    ) {
        this.textExtractor = textExtractor;
        this.graphExtractor = graphExtractor;
        this.graphLayout = graphLayout;
        this.ruleEngine = ruleEngine;
        this.geminiClient = geminiClient;
    }

    @PostMapping("/import")
    public SrsImportResponse importSrs(@RequestParam("file") MultipartFile file) throws Exception {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty.");
        }

        String text = textExtractor.extract(file);
        if (text.isBlank()) {
            throw new IllegalArgumentException("Couldn't read any text from this file.");
        }

        RawExtraction extraction = graphExtractor.extract(text);
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
        List<Finding> findings = geminiClient.synthesize(ruleFindings);

        return new SrsImportResponse(
                new SrsImportResponse.GraphJson(nodeJsons, edgeJsons),
                findings,
                geminiClient.isEnabled(),
                unrecognized.stream().sorted().toList()
        );
    }

    private static final Set<String> REPLICA_TYPES = Set.of("database", "searchIndex");

    /** Only carries config the document actually stated — see RawExtraction.RawNode's javadoc. */
    private Map<String, Object> toConfig(RawExtraction.RawNode node) {
        Map<String, Object> config = new java.util.HashMap<>();
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

    /** Mirrors SimulationEngine.capacityOf's per-type config key — null means this type isn't capacity-configurable via a single field. */
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
    public ResponseEntity<Map<String, String>> handleExtractionFailure(IllegalStateException e) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", e.getMessage()));
    }
}

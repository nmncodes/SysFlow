package dev.sysflow.interview;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.sysflow.ai.RuleEngine;
import dev.sysflow.ai.dto.AnalyzeRequest;
import dev.sysflow.ai.dto.Finding;
import dev.sysflow.interview.dto.GradeResponse;
import dev.sysflow.interview.dto.InterviewPrompt;
import dev.sysflow.simulation.model.GraphEdge;
import dev.sysflow.simulation.model.GraphNode;
import dev.sysflow.simulation.model.SimulationGraph;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Grades a submitted architecture against an interview prompt's brief. Gemini does the
 * actual rubric scoring (grounded in the same RuleEngine facts /api/ai/analyze uses, plus
 * the prompt's brief) - if it's unavailable, falls back to a single rule-derived score
 * rather than fabricating a rubric breakdown we have no basis for.
 */
@Component
public class InterviewGrader {

    private static final Logger log = LoggerFactory.getLogger(InterviewGrader.class);
    private static final List<String> RUBRIC = List.of(
            "Scalability & Capacity", "Reliability & Fault Tolerance",
            "Component Appropriateness", "Trade-off Awareness");
    private static final int MAX_PER_CATEGORY = 25;

    private final RuleEngine ruleEngine;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;
    private final String apiKey;
    private final String model;

    public InterviewGrader(
            RuleEngine ruleEngine,
            ObjectMapper objectMapper,
            @Value("${gemini.api-key:}") String apiKey,
            @Value("${gemini.model:gemini-3.6-flash}") String model
    ) {
        this.ruleEngine = ruleEngine;
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.model = model;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5_000);
        requestFactory.setReadTimeout(20_000);
        this.restClient = RestClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com/v1beta")
                .requestFactory(requestFactory)
                .build();
    }

    public boolean isEnabled() {
        return apiKey != null && !apiKey.isBlank();
    }

    public GradeResponse grade(InterviewPrompt prompt, AnalyzeRequest.GraphJson graphJson) {
        List<GraphNode> nodes = graphJson.nodes().stream()
                .map(n -> new GraphNode(n.id(), n.type(), n.config()))
                .toList();
        List<GraphEdge> edges = graphJson.edges().stream()
                .map(e -> new GraphEdge(e.id(), e.source(), e.target()))
                .toList();
        SimulationGraph graph = new SimulationGraph(nodes, edges);
        List<Finding> findings = ruleEngine.analyze(graph);

        if (!isEnabled()) {
            return ruleBasedFallback(findings, "AI grading is not configured — this is a rule-based estimate only.");
        }
        try {
            return callGemini(prompt, nodes, findings);
        } catch (Exception e) {
            log.warn("Interview grading via Gemini failed, falling back to rule-based estimate", e);
            return ruleBasedFallback(findings, "AI grading failed — this is a rule-based estimate only.");
        }
    }

    private GradeResponse callGemini(InterviewPrompt prompt, List<GraphNode> nodes, List<Finding> findings) throws Exception {
        String promptText = buildPrompt(prompt, nodes, findings);
        Map<String, Object> body = Map.of(
                "contents", List.of(Map.of("parts", List.of(Map.of("text", promptText)))),
                "generationConfig", Map.of("temperature", 0.2, "responseMimeType", "application/json")
        );

        JsonNode response = restClient.post()
                .uri("/models/{model}:generateContent?key={key}", model, apiKey)
                .body(body)
                .retrieve()
                .body(JsonNode.class);

        String text = response.path("candidates").path(0).path("content").path("parts").path(0).path("text").asText(null);
        if (text == null || text.isBlank()) {
            throw new IllegalStateException("Gemini returned no grading output.");
        }

        RawGrade raw = objectMapper.readValue(text, RawGrade.class);
        return toResponse(raw);
    }

    private record RawGrade(List<RawCategory> categories, String summary, List<String> improvements) {
        record RawCategory(String name, int score, String feedback) {
        }
    }

    /** Clamps every score into [0, MAX_PER_CATEGORY] — never trust an LLM's arithmetic blindly. */
    private GradeResponse toResponse(RawGrade raw) {
        List<GradeResponse.CategoryScore> categories = raw.categories().stream()
                .map(c -> new GradeResponse.CategoryScore(c.name(), clamp(c.score(), MAX_PER_CATEGORY), MAX_PER_CATEGORY, c.feedback()))
                .toList();
        int overall = categories.stream().mapToInt(GradeResponse.CategoryScore::score).sum();
        return new GradeResponse(clamp(overall, 100), categories, raw.summary(), raw.improvements(), true);
    }

    private int clamp(int value, int max) {
        return Math.max(0, Math.min(max, value));
    }

    private GradeResponse ruleBasedFallback(List<Finding> findings, String caveat) {
        int deduction = findings.stream().mapToInt(f -> switch (f.severity()) {
            case "critical" -> 15;
            case "warning" -> 8;
            default -> 3;
        }).sum();
        int overall = clamp(100 - deduction, 100);
        int perCategory = clamp((int) Math.round(overall / 4.0), MAX_PER_CATEGORY);

        List<GradeResponse.CategoryScore> categories = RUBRIC.stream()
                .map(name -> new GradeResponse.CategoryScore(name, perCategory, MAX_PER_CATEGORY, caveat))
                .toList();
        List<String> improvements = findings.stream().map(Finding::recommendation).limit(3).toList();
        String summary = findings.isEmpty()
                ? "No structural issues detected by the rule engine. " + caveat
                : findings.size() + " issue(s) detected by static analysis (see improvements below). " + caveat;

        return new GradeResponse(overall, categories, summary, improvements, false);
    }

    private String buildPrompt(InterviewPrompt prompt, List<GraphNode> nodes, List<Finding> findings) throws Exception {
        String graphSummary = objectMapper.writeValueAsString(nodes.stream().map(n -> Map.of("id", n.id(), "type", n.type())).toList());
        String factsJson = objectMapper.writeValueAsString(findings);
        String rubricList = String.join(", ", RUBRIC);

        return """
                You are grading a candidate's system design interview submission.

                PROBLEM: %s
                BRIEF: %s
                KEY CONSIDERATIONS THE DESIGN SHOULD ADDRESS: %s

                THE CANDIDATE'S ARCHITECTURE (component id + type; edges show request/data flow):
                %s

                DETECTED FACTS from deterministic static analysis (SPOFs, missing caches/gateways, etc.):
                %s

                Grade this submission against exactly these 4 rubric categories, each worth 0-25 points:
                %s

                Rules:
                - Base your scoring on the actual components and connections present — do not invent
                  components that aren't in the graph, and do not assume capabilities (like caching or
                  auto-scaling) unless a component of that type is actually present.
                - Weigh how well the design addresses THIS SPECIFIC problem's key considerations, not
                  generic system design best practice alone — e.g. a well-built design that ignores the
                  brief's core challenge should score low on "Trade-off Awareness" even if it's otherwise sound.
                - "feedback" per category should be 1-2 sentences, specific to what's actually in the graph.
                - "summary" is 2-3 sentences overall.
                - "improvements" is a list of 2-4 concrete, specific next steps (reference component ids where relevant).
                - Return ONLY JSON matching this exact shape, no prose, no markdown:
                  {"categories": [{"name": "...", "score": 0, "feedback": "..."}], "summary": "...", "improvements": ["..."]}

                """.formatted(prompt.title(), prompt.brief(), String.join("; ", prompt.keyConsiderations()), graphSummary, factsJson, rubricList);
    }
}

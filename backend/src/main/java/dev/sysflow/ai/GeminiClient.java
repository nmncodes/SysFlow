package dev.sysflow.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.sysflow.ai.dto.Finding;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Synthesis stage of the AI pipeline (docs/02-ARCHITECTURE.md §5).
 * Takes the RuleEngine's grounded facts and asks Gemini to rewrite them
 * as clearer, prioritized natural-language findings — the LLM's job is
 * explanation and prioritization only, never inventing new facts about
 * the graph. Any failure here (missing key, network error, bad
 * response) falls back to the rule findings unmodified, so /api/ai/analyze
 * always returns something useful.
 */
@Component
public class GeminiClient {

    private static final Logger log = LoggerFactory.getLogger(GeminiClient.class);

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;

    public GeminiClient(
            ObjectMapper objectMapper,
            @Value("${gemini.api-key:}") String apiKey,
            @Value("${gemini.model:gemini-3.6-flash}") String model
    ) {
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.model = model;
        // Spring's default request factory has NO timeout — a slow or hung Gemini call would
        // block the request thread (and the frontend's "Analyzing…" button) indefinitely
        // instead of falling back to rule-based findings like the catch block below intends.
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

    public List<Finding> synthesize(List<Finding> ruleFindings) {
        return synthesize(ruleFindings, Map.of());
    }

    /** nodeCostsById: rough monthly USD cost per node (see CostModel) — lets Gemini reference cost in its recommendations. */
    public List<Finding> synthesize(List<Finding> ruleFindings, Map<String, Double> nodeCostsById) {
        if (!isEnabled() || ruleFindings.isEmpty()) {
            return ruleFindings;
        }
        try {
            String prompt = buildPrompt(ruleFindings, nodeCostsById);
            Map<String, Object> body = Map.of(
                    "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
                    "generationConfig", Map.of("temperature", 0.2, "responseMimeType", "application/json")
            );

            JsonNode response = restClient.post()
                    .uri("/models/{model}:generateContent?key={key}", model, apiKey)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);

            String text = response
                    .path("candidates").path(0)
                    .path("content").path("parts").path(0)
                    .path("text").asText(null);
            if (text == null || text.isBlank()) return ruleFindings;

            List<Finding> parsed = objectMapper.readValue(text, objectMapper.getTypeFactory().constructCollectionType(List.class, Finding.class));
            return parsed.isEmpty() ? ruleFindings : parsed;
        } catch (Exception e) {
            log.warn("Gemini synthesis failed, falling back to rule-based findings: {}", e.getMessage());
            return ruleFindings;
        }
    }

    private String buildPrompt(List<Finding> ruleFindings, Map<String, Double> nodeCostsById) throws Exception {
        String factsJson = objectMapper.writeValueAsString(ruleFindings);
        String costSection = nodeCostsById.isEmpty()
                ? "(no cost data available)"
                : objectMapper.writeValueAsString(nodeCostsById);
        return """
                You are a system design reviewer. Below is a JSON array of DETECTED FACTS about a
                user's architecture diagram, found by deterministic static analysis. Each fact has:
                severity ("critical"|"warning"|"info"), title, affectedNodeIds, explanation, recommendation.

                Rewrite this array to be clearer and more actionable for someone learning system design.
                Rules:
                - Do NOT invent new facts, nodes, or findings not present in the input.
                - Do NOT change severity or affectedNodeIds.
                - You MAY rewrite "explanation" and "recommendation" text to be clearer and more specific.
                - MONTHLY_COST_USD below gives a rough illustrative monthly cost per node id (not real cloud
                  pricing). Where a recommendation suggests adding, replacing, or removing a component and a
                  cost figure is available for the relevant node(s), weave in an approximate cost trade-off
                  in one short clause (e.g. "for roughly $15/mo" or "at a small added cost"). Do not fabricate
                  a number for a component that isn't in MONTHLY_COST_USD, and do not force a cost mention
                  into every finding — only where it's actually informative.
                - Order the array with the most severe/important finding first.
                - Return ONLY a JSON array with the exact same shape as the input — no prose, no markdown.

                MONTHLY_COST_USD:
                %s

                FACTS:
                %s
                """.formatted(costSection, factsJson);
    }
}

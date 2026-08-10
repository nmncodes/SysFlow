package dev.sysflow.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.sysflow.ai.dto.Finding;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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
            @Value("${gemini.model:gemini-2.0-flash}") String model
    ) {
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.model = model;
        this.restClient = RestClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com/v1beta")
                .build();
    }

    public boolean isEnabled() {
        return apiKey != null && !apiKey.isBlank();
    }

    public List<Finding> synthesize(List<Finding> ruleFindings) {
        if (!isEnabled() || ruleFindings.isEmpty()) {
            return ruleFindings;
        }
        try {
            String prompt = buildPrompt(ruleFindings);
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

    private String buildPrompt(List<Finding> ruleFindings) throws Exception {
        String factsJson = objectMapper.writeValueAsString(ruleFindings);
        return """
                You are a system design reviewer. Below is a JSON array of DETECTED FACTS about a
                user's architecture diagram, found by deterministic static analysis. Each fact has:
                severity ("critical"|"warning"|"info"), title, affectedNodeIds, explanation, recommendation.

                Rewrite this array to be clearer and more actionable for someone learning system design.
                Rules:
                - Do NOT invent new facts, nodes, or findings not present in the input.
                - Do NOT change severity or affectedNodeIds.
                - You MAY rewrite "explanation" and "recommendation" text to be clearer and more specific.
                - Order the array with the most severe/important finding first.
                - Return ONLY a JSON array with the exact same shape as the input — no prose, no markdown.

                FACTS:
                %s
                """.formatted(factsJson);
    }
}

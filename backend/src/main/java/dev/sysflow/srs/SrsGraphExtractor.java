package dev.sysflow.srs;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.sysflow.srs.dto.RawExtraction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Turns raw SRS/requirements text into a candidate architecture graph via
 * Gemini, constrained to SysFlow's known component types. This is the only
 * place in the SRS-import pipeline that invents structure — everything
 * downstream (layout, rule-based trade-off analysis) is deterministic.
 */
@Component
public class SrsGraphExtractor {

    private static final Logger log = LoggerFactory.getLogger(SrsGraphExtractor.class);
    private static final int MAX_INPUT_CHARS = 20_000;

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;

    public SrsGraphExtractor(
            ObjectMapper objectMapper,
            @Value("${gemini.api-key:}") String apiKey,
            @Value("${gemini.model:gemini-3.6-flash}") String model
    ) {
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.model = model;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5_000);
        requestFactory.setReadTimeout(30_000); // SRS documents can be long, so this prompt legitimately takes longer than the analyze/grade ones
        this.restClient = RestClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com/v1beta")
                .requestFactory(requestFactory)
                .build();
    }

    public boolean isEnabled() {
        return apiKey != null && !apiKey.isBlank();
    }

    public RawExtraction extract(String documentText) {
        if (!isEnabled()) {
            throw new IllegalStateException("SRS import requires a configured Gemini API key.");
        }
        String truncated = documentText.length() > MAX_INPUT_CHARS
                ? documentText.substring(0, MAX_INPUT_CHARS)
                : documentText;

        try {
            String prompt = buildPrompt(truncated);
            Map<String, Object> body = Map.of(
                    "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
                    "generationConfig", Map.of("temperature", 0.1, "responseMimeType", "application/json")
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
            if (text == null || text.isBlank()) {
                throw new IllegalStateException("Gemini returned no extraction.");
            }

            try {
                return objectMapper.readValue(text, RawExtraction.class);
            } catch (Exception parseError) {
                log.warn("SRS extraction: Gemini response failed to parse as RawExtraction. Raw text (first 2000 chars): {}",
                        text.length() > 2000 ? text.substring(0, 2000) : text);
                throw parseError;
            }
        } catch (Exception e) {
            log.warn("SRS extraction failed", e);
            throw new IllegalStateException("Couldn't extract an architecture from this document. Try a shorter or clearer SRS.", e);
        }
    }

    /** Type names Gemini used that aren't in our known component set — surfaced to the user, not silently dropped. */
    public Set<String> unrecognizedTerms(RawExtraction extraction) {
        Set<String> out = new HashSet<>();
        for (RawExtraction.RawNode node : extraction.nodes()) {
            if (!ComponentTypes.VALID_TYPES.contains(node.type()) && node.sourceTerm() != null && !node.sourceTerm().isBlank()) {
                out.add(node.sourceTerm());
            }
        }
        return out;
    }

    private String buildPrompt(String documentText) {
        String validTypes = String.join(", ", ComponentTypes.VALID_TYPES);
        return """
                You are a system design assistant. Read the SRS / requirements document below and extract
                a candidate software architecture as a graph of components and the data flow between them.

                You MUST classify every component using ONLY these exact type strings:
                %s

                Rules:
                - "id" must be a short unique slug (lowercase, no spaces, e.g. "api_svc", "user_db").
                - "type" must be exactly one of the allowed strings above. If a mentioned technology doesn't
                  clearly map to one of them, pick the closest reasonable type (e.g. any SQL/NoSQL database ->
                  "database", a Kafka/RabbitMQ-style broker -> "messageBroker", S3-like storage -> "objectStorage",
                  Elasticsearch-like -> "searchIndex") rather than inventing a new type.
                - "label" is a short human-readable name (e.g. "User Service", "Postgres").
                - "sourceTerm" is the literal technology or actor name from the document that produced this node,
                  or null if none was mentioned explicitly.
                - Always include at least one "client" node representing the end user if the document implies one.
                - "edges" describe request/data flow direction: {"source": id, "target": id}.
                - Do not invent components not implied by the document. Keep it to the components that are
                  clearly named or clearly required (e.g. a described login flow implies a database).
                - "replicaCount" applies ONLY to "database" or "searchIndex" nodes. Set it to a number ONLY
                  when the document explicitly states a replica, failover, or high-availability requirement
                  for that specific store (e.g. "must have at least one replica" -> 1, "3 read replicas" -> 3).
                  Leave it null for every other case — do not guess or assume replication that isn't stated.
                - "capacityHint" is a requests-per-second or throughput number ONLY when the document ties a
                  specific numeric capacity/throughput/RPS requirement to THIS EXACT component by name (e.g.
                  "the API gateway must handle 5,000 requests per second" -> capacityHint 5000 on that gateway
                  node). A system-wide NFR that doesn't name a specific component does not count — leave null
                  rather than guessing which component it meant.
                - "cacheHitRatePct" applies ONLY to "cache" nodes, and ONLY when the document explicitly states
                  a target cache hit rate (e.g. "cache should serve 90%% of reads" -> 90). Leave null otherwise.
                - Return ONLY JSON matching this exact shape, no prose, no markdown:
                  {"nodes": [{"id": "...", "type": "...", "label": "...", "sourceTerm": "...", "replicaCount": null, "capacityHint": null, "cacheHitRatePct": null}], "edges": [{"source": "...", "target": "..."}]}

                DOCUMENT:
                %s
                """.formatted(validTypes, documentText);
    }
}

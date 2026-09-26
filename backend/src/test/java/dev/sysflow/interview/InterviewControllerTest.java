package dev.sysflow.interview;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The test profile has no GEMINI_API_KEY, so grading here always exercises
 * InterviewGrader's rule-based fallback path — deterministic and network-free,
 * unlike the Gemini-graded path already live-verified against production.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
// spring-dotenv loads backend/.env unconditionally (profile-independent), so a developer's
// real GEMINI_API_KEY would otherwise leak into this test and make it non-deterministic
// depending on whether that file exists locally. Inlined test properties outrank both env
// vars and .env, so this reliably forces the rule-based fallback path regardless of machine.
@TestPropertySource(properties = "gemini.api-key=")
class InterviewControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void listsSixPrompts() throws Exception {
        mockMvc.perform(get("/api/interview/prompts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(6)));
    }

    @Test
    void unknownPromptIsNotFoundWithMessage() throws Exception {
        Map<String, Object> body = Map.of("promptId", "does-not-exist", "graphJson", Map.of("nodes", List.of(), "edges", List.of()));

        // MockMvc doesn't replicate a live container's internal /error JSON-body forwarding for
        // an unhandled ResponseStatusException - the reason string is captured as getErrorMessage()
        // rather than rendered into the response body here. The JSON body's "message" field (backed
        // by server.error.include-message=always) is verified against the real running app instead.
        mockMvc.perform(post("/api/interview/grade")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isNotFound())
                .andExpect(status().reason("Unknown prompt: does-not-exist"));
    }

    @Test
    void emptyGraphIsRejected() throws Exception {
        Map<String, Object> body = Map.of("promptId", "url-shortener", "graphJson", Map.of("nodes", List.of(), "edges", List.of()));

        mockMvc.perform(post("/api/interview/grade")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void ruleBasedFallbackReturnsFourCategoriesSummingToOverall() throws Exception {
        Map<String, Object> graph = Map.of(
                "nodes", List.of(
                        Map.of("id", "client", "type", "client", "config", Map.of()),
                        Map.of("id", "db", "type", "database", "config", Map.of("replicaCount", 0))
                ),
                "edges", List.of(Map.of("id", "e1", "source", "client", "target", "db"))
        );
        Map<String, Object> body = Map.of("promptId", "url-shortener", "graphJson", graph);

        mockMvc.perform(post("/api/interview/grade")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aiEnabled").value(false))
                .andExpect(jsonPath("$.categories", hasSize(4)))
                .andExpect(jsonPath("$.categories[0].score").value(
                        org.hamcrest.Matchers.lessThanOrEqualTo(25)));
    }
}

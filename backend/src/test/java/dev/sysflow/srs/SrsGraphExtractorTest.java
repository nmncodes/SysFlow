package dev.sysflow.srs;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class SrsGraphExtractorTest {

    private static final String MODEL_URL = "https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent?key=test-key";
    private static final String EXTRACTION_RESPONSE = """
            {"candidates":[{"content":{"parts":[{"text":"{\\"nodes\\":[],\\"edges\\":[]}"}]}}]}
            """;
    private static final String UNAVAILABLE_RESPONSE = """
            {"error":{"code":503,"message":"temporarily unavailable","status":"UNAVAILABLE"}}
            """;

    @Test
    void retriesOneQuickGemini503AndReturnsTheExtraction() {
        RestClient.Builder builder = RestClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com/v1beta");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(MODEL_URL))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(UNAVAILABLE_RESPONSE));
        server.expect(requestTo(MODEL_URL))
                .andRespond(withSuccess(EXTRACTION_RESPONSE, MediaType.APPLICATION_JSON));

        SrsGraphExtractor extractor = new SrsGraphExtractor(new ObjectMapper(), "test-key", "test-model", builder.build());

        assertThat(extractor.extract("A small requirements document."))
                .satisfies(extraction -> {
                    assertThat(extraction.nodes()).isEmpty();
                    assertThat(extraction.edges()).isEmpty();
                });
        server.verify();
    }

    @Test
    void reportsTemporaryUnavailabilityAfterTheSingleRetryIsExhausted() {
        RestClient.Builder builder = RestClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com/v1beta");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        for (int attempt = 0; attempt < 2; attempt++) {
            server.expect(requestTo(MODEL_URL))
                    .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE)
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(UNAVAILABLE_RESPONSE));
        }

        SrsGraphExtractor extractor = new SrsGraphExtractor(new ObjectMapper(), "test-key", "test-model", builder.build());

        assertThatThrownBy(() -> extractor.extract("A small requirements document."))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Gemini is temporarily busy. Please wait a moment and retry the SRS import.");
        server.verify();
    }

    @Test
    void doesNotRetryNonTransientGeminiErrors() {
        RestClient.Builder builder = RestClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com/v1beta");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(MODEL_URL))
                .andRespond(withStatus(HttpStatus.FORBIDDEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":{\"code\":403}}"));

        SrsGraphExtractor extractor = new SrsGraphExtractor(new ObjectMapper(), "test-key", "test-model", builder.build());

        assertThatThrownBy(() -> extractor.extract("A small requirements document."))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Couldn't extract an architecture from this document. Try a shorter or clearer SRS.");
        server.verify();
    }
}

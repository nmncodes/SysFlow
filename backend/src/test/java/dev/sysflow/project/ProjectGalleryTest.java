package dev.sysflow.project;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * End-to-end (register -> create -> publish -> gallery -> unpublish -> delete) coverage for
 * the Phase 11 gallery feature — live-verified against production during development, this
 * locks that behavior in as a repeatable, network-free test.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProjectGalleryTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String registerAndGetToken(String email) throws Exception {
        Map<String, String> body = Map.of("email", email, "password", "password123", "displayName", "Gallery Tester");
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("token").asText();
    }

    private Map<String, Object> sampleGraph() {
        return Map.of(
                "nodes", List.of(
                        Map.of("id", "c", "type", "client", "config", Map.of()),
                        Map.of("id", "svc", "type", "service", "config", Map.of())
                ),
                "edges", List.of(Map.of("id", "e1", "source", "c", "target", "svc"))
        );
    }

    @Test
    void publishListsInGalleryAndUnpublishRemovesIt() throws Exception {
        String token = registerAndGetToken("gallery-" + System.nanoTime() + "@example.com");

        Map<String, Object> createBody = Map.of("name", "Gallery Test Project", "description", "test", "graphJson", sampleGraph());
        MvcResult created = mockMvc.perform(post("/api/projects")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createBody)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isPublicTemplate").value(false))
                .andReturn();
        String projectId = objectMapper.readTree(created.getResponse().getContentAsString()).path("id").asText();

        mockMvc.perform(get("/api/gallery"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        mockMvc.perform(put("/api/projects/" + projectId + "/publish")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"publish\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isPublicTemplate").value(true));

        MvcResult galleryAfterPublish = mockMvc.perform(get("/api/gallery"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].nodeCount").value(2))
                .andExpect(jsonPath("$[0].authorName").value("Gallery Tester"))
                .andReturn();
        assertEquals(projectId, objectMapper.readTree(galleryAfterPublish.getResponse().getContentAsString()).get(0).path("id").asText());

        // Public detail fetch works with no auth at all.
        mockMvc.perform(get("/api/public/projects/" + projectId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.graphJson.nodes.length()").value(2));

        mockMvc.perform(put("/api/projects/" + projectId + "/publish")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"publish\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isPublicTemplate").value(false));

        mockMvc.perform(get("/api/gallery"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void cannotPublishAnotherUsersProject() throws Exception {
        String ownerToken = registerAndGetToken("owner-" + System.nanoTime() + "@example.com");
        String otherToken = registerAndGetToken("other-" + System.nanoTime() + "@example.com");

        Map<String, Object> createBody = Map.of("name", "Owned Project", "description", "", "graphJson", sampleGraph());
        MvcResult created = mockMvc.perform(post("/api/projects")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createBody)))
                .andExpect(status().isOk())
                .andReturn();
        String projectId = objectMapper.readTree(created.getResponse().getContentAsString()).path("id").asText();

        mockMvc.perform(put("/api/projects/" + projectId + "/publish")
                        .header("Authorization", "Bearer " + otherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"publish\":true}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/gallery"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }
}

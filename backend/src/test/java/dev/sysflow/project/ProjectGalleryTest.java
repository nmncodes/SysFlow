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

    private Map<String, Object> graphWithLabels(String clientLabel, String serviceLabel) {
        return Map.of(
                "nodes", List.of(
                        Map.of("id", "c", "type", "client", "label", clientLabel, "config", Map.of()),
                        Map.of("id", "svc", "type", "service", "label", serviceLabel, "config", Map.of())
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

        // Public detail fetch works with no auth only after explicit publishing.
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
    void privateProjectRequiresExplicitShareLinkAndOwnerCanRevokeIt() throws Exception {
        String token = registerAndGetToken("share-" + System.nanoTime() + "@example.com");
        Map<String, Object> createBody = Map.of("name", "Private Project", "description", "", "graphJson", sampleGraph());
        MvcResult created = mockMvc.perform(post("/api/projects")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createBody)))
                .andExpect(status().isOk())
                .andReturn();
        String projectId = objectMapper.readTree(created.getResponse().getContentAsString()).path("id").asText();

        mockMvc.perform(get("/api/public/projects/" + projectId)).andExpect(status().isNotFound());

        MvcResult share = mockMvc.perform(post("/api/projects/" + projectId + "/share")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andReturn();
        String shareToken = objectMapper.readTree(share.getResponse().getContentAsString()).path("token").asText();

        mockMvc.perform(get("/api/public/projects/share/" + shareToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.graphJson.nodes.length()").value(2));

        mockMvc.perform(delete("/api/projects/" + projectId + "/share")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/public/projects/share/" + shareToken)).andExpect(status().isNotFound());
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

    @Test
    void ownerCanGrantEditorAndViewerRolesAndRevokeAccess() throws Exception {
        String suffix = Long.toString(System.nanoTime());
        String ownerToken = registerAndGetToken("collab-owner-" + suffix + "@example.com");
        String editorEmail = "collab-editor-" + suffix + "@example.com";
        String viewerEmail = "collab-viewer-" + suffix + "@example.com";
        String editorToken = registerAndGetToken(editorEmail);
        String viewerToken = registerAndGetToken(viewerEmail);

        Map<String, Object> createBody = Map.of("name", "Shared Project", "description", "", "graphJson", sampleGraph());
        MvcResult created = mockMvc.perform(post("/api/projects")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createBody)))
                .andExpect(status().isOk())
                .andReturn();
        String projectId = objectMapper.readTree(created.getResponse().getContentAsString()).path("id").asText();

        mockMvc.perform(put("/api/projects/" + projectId + "/collaborators")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + editorEmail + "\",\"role\":\"EDITOR\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("EDITOR"));
        MvcResult viewerGrant = mockMvc.perform(put("/api/projects/" + projectId + "/collaborators")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + viewerEmail + "\",\"role\":\"VIEWER\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("VIEWER"))
                .andReturn();
        String viewerId = objectMapper.readTree(viewerGrant.getResponse().getContentAsString()).path("userId").asText();

        mockMvc.perform(get("/api/projects/" + projectId).header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessRole").value("EDITOR"));
        mockMvc.perform(get("/api/projects/" + projectId).header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessRole").value("VIEWER"));

        Map<String, Object> updateBody = Map.of("name", "Updated by editor", "description", "", "graphJson", sampleGraph());
        mockMvc.perform(put("/api/projects/" + projectId)
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateBody)))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/projects/" + projectId)
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateBody)))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/projects/shared-with-me").header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].accessRole").value("VIEWER"));
        mockMvc.perform(delete("/api/projects/" + projectId + "/collaborators/" + viewerId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/projects/" + projectId).header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void collaboratorInvitationRejectsBlankEmail() throws Exception {
        String ownerToken = registerAndGetToken("collab-validation-" + System.nanoTime() + "@example.com");
        Map<String, Object> createBody = Map.of("name", "Validation Project", "description", "", "graphJson", sampleGraph());
        MvcResult created = mockMvc.perform(post("/api/projects")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createBody)))
                .andExpect(status().isOk())
                .andReturn();
        String projectId = objectMapper.readTree(created.getResponse().getContentAsString()).path("id").asText();

        mockMvc.perform(put("/api/projects/" + projectId + "/collaborators")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"  \",\"role\":\"VIEWER\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void staleSavesMergeIndependentChangesAndRejectConflictingChanges() throws Exception {
        String ownerToken = registerAndGetToken("collab-save-" + System.nanoTime() + "@example.com");
        Map<String, Object> createBody = Map.of("name", "Concurrent Save", "description", "", "graphJson", graphWithLabels("Client", "Service"));
        MvcResult created = mockMvc.perform(post("/api/projects")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createBody)))
                .andExpect(status().isOk())
                .andReturn();
        String projectId = objectMapper.readTree(created.getResponse().getContentAsString()).path("id").asText();

        Map<String, Object> firstSave = Map.of(
                "name", "Concurrent Save", "description", "", "graphJson", graphWithLabels("Client A", "Service"),
                "collaborationRevision", 0, "collaborationClientId", "tab-a");
        mockMvc.perform(put("/api/projects/" + projectId)
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(firstSave)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collaborationRevision").value(1));

        Map<String, Object> staleIndependentSave = Map.of(
                "name", "Concurrent Save", "description", "", "graphJson", graphWithLabels("Client", "Service B"),
                "collaborationRevision", 0, "collaborationClientId", "tab-b");
        mockMvc.perform(put("/api/projects/" + projectId)
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(staleIndependentSave)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collaborationRevision").value(2))
                .andExpect(jsonPath("$.graphJson.nodes[0].label").value("Client A"))
                .andExpect(jsonPath("$.graphJson.nodes[1].label").value("Service B"));

        Map<String, Object> staleConflictingSave = Map.of(
                "name", "Concurrent Save", "description", "", "graphJson", graphWithLabels("Client C", "Service"),
                "collaborationRevision", 0, "collaborationClientId", "tab-c");
        mockMvc.perform(put("/api/projects/" + projectId)
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(staleConflictingSave)))
                .andExpect(status().isConflict());

        mockMvc.perform(get("/api/projects/" + projectId).header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.graphJson.nodes[0].label").value("Client A"))
                .andExpect(jsonPath("$.graphJson.nodes[1].label").value("Service B"));
    }
}

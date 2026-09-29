package dev.sysflow.collab;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.UUID;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CollaborativeGraphServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void mergesConcurrentChangesToDifferentNodesAndEdges() throws Exception {
        CollaborativeGraphService service = new CollaborativeGraphService(mapper);
        UUID projectId = UUID.randomUUID();
        JsonNode base = graph("a", "A", "b", "B", "e0");
        JsonNode firstEdit = graph("a", "A1", "b", "B", "e0");
        JsonNode secondEdit = graph("a", "A", "b", "B1", "e1");

        CollaborativeGraphService.Result first = service.apply(projectId, 0, firstEdit, base);
        CollaborativeGraphService.Result second = service.apply(projectId, 0, secondEdit, base);

        assertTrue(first.accepted());
        assertTrue(second.accepted());
        assertEquals(2, second.revision());
        assertEquals("A1", second.graph().path("nodes").get(0).path("label").asText());
        assertEquals("B1", second.graph().path("nodes").get(1).path("label").asText());
        assertEquals(1, second.graph().path("edges").size());
        assertEquals("e1", second.graph().path("edges").get(0).path("id").asText());
    }

    @Test
    void rejectsConcurrentEditsToSameNodeWithoutReplacingAcceptedGraph() throws Exception {
        CollaborativeGraphService service = new CollaborativeGraphService(mapper);
        UUID projectId = UUID.randomUUID();
        JsonNode base = graph("a", "A", "b", "B", "e0");
        JsonNode firstEdit = graph("a", "A1", "b", "B", "e0");
        JsonNode conflictingEdit = graph("a", "A2", "b", "B", "e0");

        assertTrue(service.apply(projectId, 0, firstEdit, base).accepted());
        CollaborativeGraphService.Result conflict = service.apply(projectId, 0, conflictingEdit, base);

        assertFalse(conflict.accepted());
        assertEquals(1, conflict.revision());
        assertEquals("node:a.label", conflict.conflicts().get(0));
        assertEquals("A1", conflict.graph().path("nodes").get(0).path("label").asText());
    }

    @Test
    void mergesIndependentFieldsOnTheSameNode() throws Exception {
        CollaborativeGraphService service = new CollaborativeGraphService(mapper);
        UUID projectId = UUID.randomUUID();
        JsonNode base = graph("a", "A", "b", "B", "e0");
        JsonNode firstEdit = base.deepCopy();
        JsonNode secondEdit = base.deepCopy();
        ((ObjectNode) firstEdit.path("nodes").get(0).path("config")).put("readTimeout", 10);
        ((ObjectNode) firstEdit.path("nodes").get(0).path("position")).put("x", 40);
        ((ObjectNode) secondEdit.path("nodes").get(0).path("config")).put("writeTimeout", 20);

        assertTrue(service.apply(projectId, 0, firstEdit, base).accepted());
        CollaborativeGraphService.Result merged = service.apply(projectId, 0, secondEdit, base);

        assertTrue(merged.accepted());
        JsonNode node = merged.graph().path("nodes").get(0);
        assertEquals(10, node.path("config").path("readTimeout").asInt());
        assertEquals(20, node.path("config").path("writeTimeout").asInt());
        assertEquals(40, node.path("position").path("x").asInt());
    }

    @Test
    void rejectsSnapshotsWhoseRevisionHasExpiredFromHistory() throws Exception {
        CollaborativeGraphService service = new CollaborativeGraphService(mapper);
        UUID projectId = UUID.randomUUID();
        JsonNode base = graph("a", "A", "b", "B", "e0");
        for (long revision = 0; revision < 129; revision++) {
            assertTrue(service.apply(projectId, revision, base, base).accepted());
        }

        CollaborativeGraphService.Result invalid = service.apply(projectId, 0, base, base);

        assertFalse(invalid.accepted());
        assertEquals(List.of("graph"), invalid.conflicts());
    }

    private JsonNode graph(String firstId, String firstLabel, String secondId, String secondLabel, String edgeId) throws Exception {
        return mapper.readTree("""
                {"nodes":[
                  {"id":"%s","type":"service","label":"%s","config":{},"position":{"x":0,"y":0}},
                  {"id":"%s","type":"database","label":"%s","config":{},"position":{"x":1,"y":1}}
                ],"edges":[{"id":"%s","source":"a","target":"b"}]}
                """.formatted(firstId, firstLabel, secondId, secondLabel, edgeId));
    }
}

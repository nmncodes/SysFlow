package dev.sysflow.collab;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import dev.sysflow.project.Project;
import dev.sysflow.project.ProjectRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class CollaborativeGraphServiceTest {

    @Autowired private ObjectMapper mapper;
    @Autowired private CollaborativeGraphService service;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private ProjectCollaborationStateRepository stateRepository;
    @Autowired private ProjectGraphRevisionRepository revisionRepository;
    @Autowired private PlatformTransactionManager transactionManager;

    @Test
    void mergesConcurrentChangesToDifferentNodesAndEdges() throws Exception {
        JsonNode base = graph("a", "A", "b", "B", "e0");
        UUID projectId = createProject(base);
        JsonNode firstEdit = graph("a", "A1", "b", "B", "e0");
        JsonNode secondEdit = graph("a", "A", "b", "B1", "e1");

        CollaborativeGraphService.Result first = service.apply(projectId, 0, firstEdit);
        CollaborativeGraphService.Result second = service.apply(projectId, 0, secondEdit);

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
        JsonNode base = graph("a", "A", "b", "B", "e0");
        UUID projectId = createProject(base);
        JsonNode firstEdit = graph("a", "A1", "b", "B", "e0");
        JsonNode conflictingEdit = graph("a", "A2", "b", "B", "e0");

        assertTrue(service.apply(projectId, 0, firstEdit).accepted());
        CollaborativeGraphService.Result conflict = service.apply(projectId, 0, conflictingEdit);

        assertFalse(conflict.accepted());
        assertEquals(1, conflict.revision());
        assertEquals("node:a.label", conflict.conflicts().get(0));
        assertEquals("A1", conflict.graph().path("nodes").get(0).path("label").asText());
    }

    @Test
    void mergesIndependentFieldsOnTheSameNode() throws Exception {
        JsonNode base = graph("a", "A", "b", "B", "e0");
        UUID projectId = createProject(base);
        JsonNode firstEdit = base.deepCopy();
        JsonNode secondEdit = base.deepCopy();
        ((ObjectNode) firstEdit.path("nodes").get(0).path("config")).put("readTimeout", 10);
        ((ObjectNode) firstEdit.path("nodes").get(0).path("position")).put("x", 40);
        ((ObjectNode) secondEdit.path("nodes").get(0).path("config")).put("writeTimeout", 20);

        assertTrue(service.apply(projectId, 0, firstEdit).accepted());
        CollaborativeGraphService.Result merged = service.apply(projectId, 0, secondEdit);

        assertTrue(merged.accepted());
        JsonNode node = merged.graph().path("nodes").get(0);
        assertEquals(10, node.path("config").path("readTimeout").asInt());
        assertEquals(20, node.path("config").path("writeTimeout").asInt());
        assertEquals(40, node.path("position").path("x").asInt());
    }

    @Test
    void rejectsSnapshotsWhoseRevisionHasExpiredFromDurableHistory() throws Exception {
        JsonNode graph = graph("a", "A", "b", "B", "e0");
        UUID projectId = createProject(graph);
        for (long revision = 0; revision < 129; revision++) {
            assertTrue(service.apply(projectId, revision, graph).accepted());
        }

        CollaborativeGraphService.Result invalid = service.apply(projectId, 0, graph);

        assertFalse(invalid.accepted());
        assertEquals(List.of("graph"), invalid.conflicts());
        assertEquals(128, revisionRepository.findAll().stream().filter(item -> item.getProjectId().equals(projectId)).count());
    }

    @Test
    void anotherServiceInstanceReadsThePersistedRevisionAndMergeBase() throws Exception {
        JsonNode base = graph("a", "A", "b", "B", "e0");
        UUID projectId = createProject(base);
        assertTrue(service.apply(projectId, 0, graph("a", "A1", "b", "B", "e0")).accepted());
        JsonNode edit = graph("a", "A", "b", "B1", "e0");

        CollaborativeGraphService anotherInstance = new CollaborativeGraphService(
                mapper, projectRepository, stateRepository, revisionRepository);
        CollaborativeGraphService.Result result = new TransactionTemplate(transactionManager)
                .execute(status -> anotherInstance.apply(projectId, 0, edit));

        assertNotNull(result);
        assertTrue(result.accepted());
        assertEquals(2, result.revision());
        assertEquals("A1", result.graph().path("nodes").get(0).path("label").asText());
        assertEquals("B1", result.graph().path("nodes").get(1).path("label").asText());
    }

    @Test
    void serializesSimultaneousWritesAcrossServiceInstances() throws Exception {
        JsonNode base = graph("a", "A", "b", "B", "e0");
        UUID projectId = createProject(base);
        CollaborativeGraphService anotherInstance = new CollaborativeGraphService(
                mapper, projectRepository, stateRepository, revisionRepository);
        JsonNode firstEdit = graph("a", "A1", "b", "B", "e0");
        JsonNode secondEdit = graph("a", "A", "b", "B1", "e0");
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<CollaborativeGraphService.Result> first = executor.submit(() -> {
                start.await();
                return service.apply(projectId, 0, firstEdit);
            });
            Future<CollaborativeGraphService.Result> second = executor.submit(() -> {
                start.await();
                return new TransactionTemplate(transactionManager).execute(status ->
                        anotherInstance.apply(projectId, 0, secondEdit));
            });
            start.countDown();

            CollaborativeGraphService.Result firstResult = first.get();
            CollaborativeGraphService.Result secondResult = second.get();
            assertTrue(firstResult.accepted());
            assertNotNull(secondResult);
            assertTrue(secondResult.accepted());
            assertEquals(2, secondResult.revision());
            assertEquals("A1", secondResult.graph().path("nodes").get(0).path("label").asText());
            assertEquals("B1", secondResult.graph().path("nodes").get(1).path("label").asText());
        }
    }

    private UUID createProject(JsonNode graph) throws Exception {
        Project project = projectRepository.saveAndFlush(new Project(UUID.randomUUID(), "Collab test", "", mapper.writeValueAsString(graph)));
        return project.getId();
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

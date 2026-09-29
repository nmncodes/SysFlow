package dev.sysflow.collab;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import dev.sysflow.project.Project;
import dev.sysflow.project.ProjectRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Serializes graph revisions and merges independent node/edge changes from stale clients. */
@Service
public class CollaborativeGraphService {

    private static final int HISTORY_LIMIT = 128;

    private final ObjectMapper objectMapper;
    private final ProjectRepository projectRepository;
    private final ProjectCollaborationStateRepository stateRepository;
    private final ProjectGraphRevisionRepository revisionRepository;

    public CollaborativeGraphService(ObjectMapper objectMapper, ProjectRepository projectRepository,
                                     ProjectCollaborationStateRepository stateRepository,
                                     ProjectGraphRevisionRepository revisionRepository) {
        this.objectMapper = objectMapper;
        this.projectRepository = projectRepository;
        this.stateRepository = stateRepository;
        this.revisionRepository = revisionRepository;
    }

    @Transactional
    public Result apply(UUID projectId, long baseRevision, JsonNode submittedGraph) {
        Project project = lockProject(projectId);
        ProjectCollaborationState state = loadOrCreateState(project);
        JsonNode currentGraph = readGraph(state.getGraphJson());
        if (!isGraph(submittedGraph)) {
            return new Result(false, state.getRevision(), currentGraph, List.of("graph:invalid"));
        }

        ProjectGraphRevision baseRevisionEntity = revisionRepository.findByProjectIdAndRevision(projectId, baseRevision).orElse(null);
        if (baseRevisionEntity == null) {
            return new Result(false, state.getRevision(), currentGraph, List.of("graph"));
        }
        JsonNode baseGraph = readGraph(baseRevisionEntity.getGraphJson());

        JsonNode acceptedGraph;
        List<String> conflicts = new ArrayList<>();
        if (baseRevision == state.getRevision()) {
            acceptedGraph = submittedGraph.deepCopy();
        } else {
            acceptedGraph = merge(baseGraph, currentGraph, submittedGraph, conflicts);
        }

        if (!conflicts.isEmpty()) {
            return new Result(false, state.getRevision(), currentGraph, List.copyOf(conflicts));
        }

        long nextRevision = state.getRevision() + 1;
        state.setRevision(nextRevision);
        state.setGraphJson(writeGraph(acceptedGraph));
        stateRepository.save(state);
        revisionRepository.save(new ProjectGraphRevision(projectId, nextRevision, state.getGraphJson()));
        revisionRepository.deleteByProjectIdAndRevisionLessThan(projectId, Math.max(0, nextRevision - HISTORY_LIMIT + 1));
        return new Result(true, nextRevision, acceptedGraph.deepCopy(), List.of());
    }

    @Transactional
    public Result snapshot(UUID projectId) {
        ProjectCollaborationState state = loadOrCreateState(lockProject(projectId));
        return new Result(true, state.getRevision(), readGraph(state.getGraphJson()), List.of());
    }

    @Transactional
    public void remove(UUID projectId) {
        revisionRepository.deleteByProjectId(projectId);
        stateRepository.findById(projectId).ifPresent(stateRepository::delete);
    }

    private Project lockProject(UUID projectId) {
        return projectRepository.findByIdForUpdate(projectId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));
    }

    private ProjectCollaborationState loadOrCreateState(Project project) {
        return stateRepository.findById(project.getId()).orElseGet(() -> {
            JsonNode initialGraph = readGraph(project.getGraphJson());
            ProjectCollaborationState initial = new ProjectCollaborationState(project.getId(), 0, writeGraph(initialGraph));
            stateRepository.save(initial);
            revisionRepository.save(new ProjectGraphRevision(project.getId(), 0, initial.getGraphJson()));
            return initial;
        });
    }

    private JsonNode readGraph(String graphJson) {
        try {
            return objectMapper.readTree(graphJson);
        } catch (Exception exception) {
            throw new IllegalStateException("Stored collaboration graph is invalid", exception);
        }
    }

    private String writeGraph(JsonNode graph) {
        try {
            return objectMapper.writeValueAsString(graph);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Unable to serialize collaboration graph", exception);
        }
    }

    private JsonNode merge(JsonNode base, JsonNode current, JsonNode submitted, List<String> conflicts) {
        if (!isGraph(base) || !isGraph(current) || !isGraph(submitted)) {
            conflicts.add("graph");
            return current.deepCopy();
        }

        ObjectNode merged = current.deepCopy();
        merged.set("nodes", mergeEntities("node", base.path("nodes"), current.path("nodes"), submitted.path("nodes"), conflicts));
        merged.set("edges", mergeEntities("edge", base.path("edges"), current.path("edges"), submitted.path("edges"), conflicts));
        return merged;
    }

    private ArrayNode mergeEntities(String kind, JsonNode base, JsonNode current, JsonNode submitted, List<String> conflicts) {
        Map<String, JsonNode> baseById = entitiesById(base);
        Map<String, JsonNode> currentById = entitiesById(current);
        Map<String, JsonNode> submittedById = entitiesById(submitted);
        if (baseById == null || currentById == null || submittedById == null) {
            conflicts.add(kind + ":invalid");
            return objectMapper.createArrayNode();
        }

        LinkedHashSet<String> ids = new LinkedHashSet<>();
        ids.addAll(currentById.keySet());
        ids.addAll(submittedById.keySet());
        ArrayNode result = objectMapper.createArrayNode();
        for (String id : ids) {
            JsonNode before = baseById.get(id);
            JsonNode now = currentById.get(id);
            JsonNode incoming = submittedById.get(id);
            JsonNode chosen = mergeValue(before, now, incoming, kind + ":" + id, conflicts);
            if (chosen != null) result.add(chosen.deepCopy());
        }
        return result;
    }

    private JsonNode mergeValue(JsonNode base, JsonNode current, JsonNode submitted, String path, List<String> conflicts) {
        if (same(base, current)) return copy(submitted);
        if (same(base, submitted) || same(current, submitted)) return copy(current);

        boolean canMergeObjects = current != null && submitted != null && current.isObject() && submitted.isObject()
                && (base == null || base.isObject());
        if (canMergeObjects) {
            ObjectNode merged = objectMapper.createObjectNode();
            LinkedHashSet<String> fields = new LinkedHashSet<>();
            if (base != null) base.fieldNames().forEachRemaining(fields::add);
            current.fieldNames().forEachRemaining(fields::add);
            submitted.fieldNames().forEachRemaining(fields::add);
            for (String field : fields) {
                JsonNode value = mergeValue(base == null ? null : base.get(field), current.get(field), submitted.get(field), path + "." + field, conflicts);
                if (value != null) merged.set(field, value);
            }
            return merged;
        }

        conflicts.add(path);
        return copy(current);
    }

    private JsonNode copy(JsonNode value) {
        return value == null ? null : value.deepCopy();
    }

    private Map<String, JsonNode> entitiesById(JsonNode array) {
        if (!array.isArray()) return null;
        Map<String, JsonNode> result = new LinkedHashMap<>();
        Iterator<JsonNode> iterator = array.elements();
        while (iterator.hasNext()) {
            JsonNode entity = iterator.next();
            JsonNode id = entity.path("id");
            if (!entity.isObject() || !id.isTextual() || id.asText().isBlank() || result.putIfAbsent(id.asText(), entity) != null) {
                return null;
            }
        }
        return result;
    }

    private boolean isGraph(JsonNode graph) {
        return graph != null && graph.isObject() && graph.path("nodes").isArray() && graph.path("edges").isArray();
    }

    private boolean same(JsonNode left, JsonNode right) {
        return left == null ? right == null : left.equals(right);
    }

    public record Result(boolean accepted, long revision, JsonNode graph, List<String> conflicts) {
    }
}

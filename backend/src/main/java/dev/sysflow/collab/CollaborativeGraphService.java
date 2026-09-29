package dev.sysflow.collab;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Serializes graph revisions and merges independent node/edge changes from stale clients. */
@Service
public class CollaborativeGraphService {

    private static final int HISTORY_LIMIT = 128;

    private final ObjectMapper objectMapper;
    private final Map<UUID, ProjectState> projects = new ConcurrentHashMap<>();

    public CollaborativeGraphService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public Result apply(UUID projectId, long baseRevision, JsonNode submittedGraph, JsonNode persistedGraph) {
        ProjectState state = projects.computeIfAbsent(projectId, ignored -> new ProjectState(persistedGraph.deepCopy()));
        synchronized (state) {
            if (!isGraph(submittedGraph)) {
                return new Result(false, state.revision, state.graph.deepCopy(), List.of("graph:invalid"));
            }
            JsonNode baseGraph = state.history.get(baseRevision);
            if (baseGraph == null) {
                return new Result(false, state.revision, state.graph.deepCopy(), List.of("graph"));
            }

            JsonNode acceptedGraph;
            List<String> conflicts = new ArrayList<>();
            if (baseRevision == state.revision) {
                acceptedGraph = submittedGraph.deepCopy();
            } else {
                acceptedGraph = merge(baseGraph, state.graph, submittedGraph, conflicts);
            }

            if (!conflicts.isEmpty()) {
                return new Result(false, state.revision, state.graph.deepCopy(), List.copyOf(conflicts));
            }

            state.graph = acceptedGraph.deepCopy();
            state.revision++;
            state.history.put(state.revision, state.graph.deepCopy());
            trimHistory(state.history);
            return new Result(true, state.revision, state.graph.deepCopy(), List.of());
        }
    }

    public Result snapshot(UUID projectId, JsonNode persistedGraph) {
        ProjectState state = projects.computeIfAbsent(projectId, ignored -> new ProjectState(persistedGraph.deepCopy()));
        synchronized (state) {
            return new Result(true, state.revision, state.graph.deepCopy(), List.of());
        }
    }

    public void remove(UUID projectId) {
        projects.remove(projectId);
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

    private void trimHistory(LinkedHashMap<Long, JsonNode> history) {
        while (history.size() > HISTORY_LIMIT) {
            history.remove(history.keySet().iterator().next());
        }
    }

    private static final class ProjectState {
        private long revision;
        private JsonNode graph;
        private final LinkedHashMap<Long, JsonNode> history = new LinkedHashMap<>();

        private ProjectState(JsonNode initialGraph) {
            graph = initialGraph;
            history.put(0L, initialGraph.deepCopy());
        }
    }

    public record Result(boolean accepted, long revision, JsonNode graph, List<String> conflicts) {
    }
}

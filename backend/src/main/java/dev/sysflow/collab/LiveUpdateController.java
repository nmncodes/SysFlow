package dev.sysflow.collab;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.sysflow.project.Project;
import dev.sysflow.project.ProjectCollaboratorRepository;
import dev.sysflow.project.ProjectRepository;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The server assigns ordered graph revisions and merges stale snapshots by stable node and edge
 * IDs. Conflicting edits to the same item are rejected and returned privately to the sender.
 * WebSocketConfig authenticates CONNECT frames, limits client sends to these handlers, and
 * authorizes room access before a handler runs.
 */
@Controller
public class LiveUpdateController {

    private final SimpMessagingTemplate messagingTemplate;
    private final ProjectRepository projectRepository;
    private final ProjectCollaboratorRepository collaboratorRepository;
    private final CollaborativeGraphService graphService;
    private final ObjectMapper objectMapper;

    public LiveUpdateController(SimpMessagingTemplate messagingTemplate, ProjectRepository projectRepository,
                                ProjectCollaboratorRepository collaboratorRepository,
                                CollaborativeGraphService graphService, ObjectMapper objectMapper) {
        this.messagingTemplate = messagingTemplate;
        this.projectRepository = projectRepository;
        this.collaboratorRepository = collaboratorRepository;
        this.graphService = graphService;
        this.objectMapper = objectMapper;
    }

    @MessageMapping("/project/{projectId}/broadcast")
    public void broadcast(@DestinationVariable String rawProjectId, Map<String, Object> message, Principal principal) {
        UUID projectId = UUID.fromString(rawProjectId);
        if (!"graph".equals(message.get("type"))) return;

        long baseRevision = message.get("baseRevision") instanceof Number number ? number.longValue() : 0L;
        JsonNode submittedGraph = objectMapper.valueToTree(message.get("payload"));
        CollaborativeGraphService.Result result = graphService.apply(projectId, baseRevision, submittedGraph);
        if (result.accepted()) {
            broadcastToMembers(projectId, Map.of(
                    "type", "graph",
                    "clientId", message.getOrDefault("clientId", "unknown"),
                    "revision", result.revision(),
                    "payload", result.graph()
            ));
        } else if (principal != null) {
            messagingTemplate.convertAndSendToUser(principal.getName(), "/queue/collaboration-conflicts", Map.of(
                    "type", "conflict",
                    "clientId", message.getOrDefault("clientId", "unknown"),
                    "revision", result.revision(),
                    "payload", result.graph(),
                    "conflicts", result.conflicts()
            ));
        }
    }

    @MessageMapping("/project/{projectId}/presence")
    public void presence(@DestinationVariable String rawProjectId, Map<String, Object> message, Principal principal) {
        UUID projectId = UUID.fromString(rawProjectId);
        if ("presence-join".equals(message.get("type")) && Boolean.TRUE.equals(message.get("initial")) && principal != null) {
            CollaborativeGraphService.Result snapshot = graphService.snapshot(projectId);
            messagingTemplate.convertAndSendToUser(principal.getName(), "/queue/project/" + projectId, Map.of(
                    "type", "graph",
                    "clientId", "server",
                    "revision", snapshot.revision(),
                    "payload", snapshot.graph()
            ));
        }
        if (Set.of("presence-join", "presence-leave", "cursor").contains(message.get("type"))) {
            broadcastToMembers(projectId, message);
        }
    }

    // ponytail: 10s TTL cache, per-project ConcurrentHashMap if contention matters
    private record CachedMembers(Set<UUID> members, long expiresAt) {}
    private final ConcurrentHashMap<UUID, CachedMembers> memberCache = new ConcurrentHashMap<>();
    private static final long MEMBER_CACHE_TTL_MS = 10_000;

    private void broadcastToMembers(UUID projectId, Object message) {
        long now = System.currentTimeMillis();
        CachedMembers cached = memberCache.get(projectId);
        Set<UUID> members;
        if (cached != null && now < cached.expiresAt()) {
            members = cached.members();
        } else {
            Project project = projectRepository.findById(projectId).orElse(null);
            if (project == null) return;
            members = new LinkedHashSet<>();
            members.add(project.getUserId());
            collaboratorRepository.findByProjectIdOrderByCreatedAtAsc(projectId)
                    .forEach(collaborator -> members.add(collaborator.getUserId()));
            memberCache.put(projectId, new CachedMembers(Set.copyOf(members), now + MEMBER_CACHE_TTL_MS));
        }
        for (UUID userId : members) {
            messagingTemplate.convertAndSendToUser(userId.toString(), "/queue/project/" + projectId, message);
        }
    }
}

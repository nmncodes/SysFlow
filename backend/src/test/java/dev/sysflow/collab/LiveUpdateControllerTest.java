package dev.sysflow.collab;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.sysflow.project.CollaboratorRole;
import dev.sysflow.project.Project;
import dev.sysflow.project.ProjectCollaborator;
import dev.sysflow.project.ProjectCollaboratorRepository;
import dev.sysflow.project.ProjectRepository;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class LiveUpdateControllerTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void graphUpdatesReachCurrentMembersThroughPrivateQueues() throws Exception {
        UUID projectId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID editorId = UUID.randomUUID();
        Project project = project(projectId, ownerId);
        ProjectRepository projects = mock(ProjectRepository.class);
        ProjectCollaboratorRepository collaborators = mock(ProjectCollaboratorRepository.class);
        SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
        when(projects.findById(projectId)).thenReturn(Optional.of(project));
        when(collaborators.findByProjectIdOrderByCreatedAtAsc(projectId)).thenReturn(
                List.of(new ProjectCollaborator(projectId, editorId, CollaboratorRole.EDITOR)));
        LiveUpdateController controller = new LiveUpdateController(
                messaging, projects, collaborators, new CollaborativeGraphService(mapper), mapper);
        JsonNode graph = mapper.readTree("{\"nodes\":[{\"id\":\"n1\",\"type\":\"service\",\"label\":\"Service\",\"config\":{},\"position\":{\"x\":1,\"y\":2}}],\"edges\":[]}");
        Principal principal = () -> editorId.toString();

        controller.broadcast(projectId.toString(), Map.of(
                "type", "graph", "clientId", "tab-1", "baseRevision", 0, "payload", graph), principal);

        String destination = "/queue/project/" + projectId;
        verify(messaging).convertAndSendToUser(eq(ownerId.toString()), eq(destination), any());
        verify(messaging).convertAndSendToUser(eq(editorId.toString()), eq(destination), any());
        verify(messaging, times(2)).convertAndSendToUser(anyString(), eq(destination), any());
        verify(messaging, never()).convertAndSend(eq("/topic/project/" + projectId), any(JsonNode.class));
    }

    @Test
    void revokedCollaboratorIsNotIncludedInLaterRoomDelivery() {
        UUID projectId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID revokedUserId = UUID.randomUUID();
        ProjectRepository projects = mock(ProjectRepository.class);
        ProjectCollaboratorRepository collaborators = mock(ProjectCollaboratorRepository.class);
        SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
        when(projects.findById(projectId)).thenReturn(Optional.of(project(projectId, ownerId)));
        when(collaborators.findByProjectIdOrderByCreatedAtAsc(projectId)).thenReturn(List.of());
        LiveUpdateController controller = new LiveUpdateController(
                messaging, projects, collaborators, new CollaborativeGraphService(mapper), mapper);

        controller.presence(projectId.toString(), Map.of("type", "cursor", "clientId", "tab-1"), () -> ownerId.toString());

        verify(messaging).convertAndSendToUser(eq(ownerId.toString()), eq("/queue/project/" + projectId), any());
        verify(messaging, never()).convertAndSendToUser(eq(revokedUserId.toString()), anyString(), any());
    }

    private Project project(UUID id, UUID ownerId) {
        Project project = new Project(ownerId, "Test", "", "{\"nodes\":[],\"edges\":[]}");
        ReflectionTestUtils.setField(project, "id", id);
        return project;
    }
}

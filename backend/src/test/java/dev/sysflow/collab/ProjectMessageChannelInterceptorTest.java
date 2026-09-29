package dev.sysflow.collab;

import dev.sysflow.auth.JwtService;
import dev.sysflow.project.ProjectAccessService;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProjectMessageChannelInterceptorTest {

    private final UUID projectId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final JwtService jwtService = mock(JwtService.class);
    private final ProjectAccessService access = mock(ProjectAccessService.class);
    private final ProjectMessageChannelInterceptor interceptor = new ProjectMessageChannelInterceptor(jwtService, access);
    private final MessageChannel channel = mock(MessageChannel.class);

    @Test
    void viewerCanSendPresenceButCannotSendGraphChanges() {
        StompHeaderAccessor presence = accessor(StompCommand.SEND, "/app/project/" + projectId + "/presence", userId);
        assertNotNull(interceptor.preSend(message(presence), channel));
        verify(access).requireView(projectId, userId);

        doThrow(new AccessDeniedException("viewer")).when(access).requireEdit(projectId, userId);
        StompHeaderAccessor graph = accessor(StompCommand.SEND, "/app/project/" + projectId + "/broadcast", userId);
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(message(graph), channel));
    }

    @Test
    void rejectsDirectBrokerWritesAndUnscopedSubscriptions() {
        StompHeaderAccessor brokerWrite = accessor(StompCommand.SEND, "/topic/project/" + projectId, userId);
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(message(brokerWrite), channel));

        StompHeaderAccessor publicTopic = accessor(StompCommand.SUBSCRIBE, "/topic/project/" + projectId, userId);
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(message(publicTopic), channel));
    }

    @Test
    void permitsMemberSubscriptionsOnlyForTheExactProjectRoom() {
        StompHeaderAccessor room = accessor(StompCommand.SUBSCRIBE, "/user/queue/project/" + projectId, userId);
        assertNotNull(interceptor.preSend(message(room), channel));
        verify(access).requireView(projectId, userId);

        StompHeaderAccessor nestedRoom = accessor(StompCommand.SUBSCRIBE, "/user/queue/project/" + projectId + "/extra", userId);
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(message(nestedRoom), channel));
    }

    private StompHeaderAccessor accessor(StompCommand command, String destination, UUID principalId) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
        accessor.setDestination(destination);
        accessor.setUser(() -> principalId.toString());
        return accessor;
    }

    private Message<byte[]> message(StompHeaderAccessor accessor) {
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}

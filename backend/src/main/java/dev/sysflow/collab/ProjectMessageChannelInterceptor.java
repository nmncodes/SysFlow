package dev.sysflow.collab;

import dev.sysflow.auth.JwtService;
import dev.sysflow.project.ProjectAccessService;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.util.List;
import java.util.UUID;

/** Authenticates STOMP sessions and only permits member room reads and authorized project actions. */
final class ProjectMessageChannelInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;
    private final ProjectAccessService access;

    ProjectMessageChannelInterceptor(JwtService jwtService, ProjectAccessService access) {
        this.jwtService = jwtService;
        this.access = access;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        if (StompCommand.CONNECT.equals(accessor.getCommand())) authenticate(accessor);
        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            String destination = accessor.getDestination();
            if ("/user/queue/collaboration-conflicts".equals(destination) && accessor.getUser() != null) return message;
            if (destination == null || !destination.startsWith("/user/queue/project/")) {
                throw new AccessDeniedException("Client subscriptions must use an authorized project destination");
            }
            authorizeProjectDestination(accessor, "/user/queue/project/", "", false);
        }
        if (StompCommand.SEND.equals(accessor.getCommand())) authorizeSend(accessor);
        return message;
    }

    private void authenticate(StompHeaderAccessor accessor) {
        String authorization = accessor.getFirstNativeHeader("Authorization");
        UUID userId = authorization != null && authorization.startsWith("Bearer ")
                ? jwtService.validateAndGetUserId(authorization.substring(7)) : null;
        if (userId == null) throw new AccessDeniedException("Authentication required");
        accessor.setUser(new UsernamePasswordAuthenticationToken(userId.toString(), null, List.of()));
    }

    private void authorizeSend(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (destination == null || !destination.startsWith("/app/project/")) {
            throw new AccessDeniedException("Client messages must use an authorized project destination");
        }
        if (destination.endsWith("/broadcast")) {
            authorizeProjectDestination(accessor, "/app/project/", "/broadcast", true);
        } else if (destination.endsWith("/presence")) {
            authorizeProjectDestination(accessor, "/app/project/", "/presence", false);
        } else {
            throw new AccessDeniedException("Client messages must use an authorized project destination");
        }
    }

    private void authorizeProjectDestination(StompHeaderAccessor accessor, String prefix, String suffix, boolean edit) {
        String destination = accessor.getDestination();
        if (destination == null || !destination.startsWith(prefix) || accessor.getUser() == null) {
            throw new AccessDeniedException("Not allowed to access this destination");
        }
        String path = destination.substring(prefix.length());
        if (!suffix.isEmpty()) {
            if (!path.endsWith(suffix)) throw new AccessDeniedException("Not allowed to send to this destination");
            path = path.substring(0, path.length() - suffix.length());
        }
        if (path.contains("/")) throw new AccessDeniedException("Not allowed to access this destination");
        try {
            UUID projectId = UUID.fromString(path);
            UUID userId = UUID.fromString(accessor.getUser().getName());
            if (edit) access.requireEdit(projectId, userId);
            else access.requireView(projectId, userId);
        } catch (Exception e) {
            throw new AccessDeniedException("Not allowed to access this project");
        }
    }
}

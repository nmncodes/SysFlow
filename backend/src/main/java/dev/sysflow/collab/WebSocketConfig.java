package dev.sysflow.collab;

import dev.sysflow.auth.JwtService;
import dev.sysflow.project.ProjectAccessService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.List;
import java.util.UUID;

/**
 * Authenticated STOMP transport. Every room subscription and edit is authorized against
 * the project's owner/editor/viewer membership.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final String[] allowedOrigins;
    private final JwtService jwtService;
    private final ProjectAccessService access;

    public WebSocketConfig(@Value("${cors.allowed-origins:http://localhost:5173}") String allowedOriginsCsv,
                           JwtService jwtService, ProjectAccessService access) {
        this.allowedOrigins = allowedOriginsCsv.split(",");
        for (int i = 0; i < this.allowedOrigins.length; i++) {
            this.allowedOrigins[i] = this.allowedOrigins[i].trim();
        }
        this.jwtService = jwtService;
        this.access = access;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOrigins(allowedOrigins);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
                if (StompCommand.CONNECT.equals(accessor.getCommand())) authenticate(accessor);
                if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) authorize(accessor, "/topic/project/", false);
                if (StompCommand.SEND.equals(accessor.getCommand())) authorize(accessor, "/app/project/", true);
                return message;
            }
        });
    }

    private void authenticate(StompHeaderAccessor accessor) {
        String authorization = accessor.getFirstNativeHeader("Authorization");
        UUID userId = authorization != null && authorization.startsWith("Bearer ")
                ? jwtService.validateAndGetUserId(authorization.substring(7)) : null;
        if (userId == null) throw new AccessDeniedException("Authentication required");
        accessor.setUser(new UsernamePasswordAuthenticationToken(userId.toString(), null, List.of()));
    }

    private void authorize(StompHeaderAccessor accessor, String prefix, boolean edit) {
        String destination = accessor.getDestination();
        if (destination == null || !destination.startsWith(prefix) || accessor.getUser() == null) {
            throw new AccessDeniedException("Not allowed to access this destination");
        }
        String rawProjectId = destination.substring(prefix.length()).replace("/broadcast", "");
        try {
            UUID projectId = UUID.fromString(rawProjectId);
            UUID userId = UUID.fromString(accessor.getUser().getName());
            if (edit) access.requireEdit(projectId, userId);
            else access.requireView(projectId, userId);
        } catch (Exception e) {
            throw new AccessDeniedException("Not allowed to access this project");
        }
    }
}

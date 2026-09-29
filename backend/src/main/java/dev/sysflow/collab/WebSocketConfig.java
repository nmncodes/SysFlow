package dev.sysflow.collab;

import dev.sysflow.auth.JwtService;
import dev.sysflow.project.ProjectAccessService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

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
        registry.enableSimpleBroker("/queue");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ProjectMessageChannelInterceptor(jwtService, access));
    }
}

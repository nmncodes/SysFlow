package dev.sysflow.collab;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Live collaboration transport: STOMP over a plain WebSocket at /ws (no SockJS — every
 * client here is a real browser or a test WebSocket client, no legacy-browser fallback
 * needed). One topic per project id; see LiveUpdateController for the relay logic and
 * docs/05-ROADMAP.md for the last-write-wins design this deliberately keeps simple.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final String[] allowedOrigins;

    public WebSocketConfig(@Value("${cors.allowed-origins:http://localhost:5173}") String allowedOriginsCsv) {
        this.allowedOrigins = allowedOriginsCsv.split(",");
        for (int i = 0; i < this.allowedOrigins.length; i++) {
            this.allowedOrigins[i] = this.allowedOrigins[i].trim();
        }
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
}

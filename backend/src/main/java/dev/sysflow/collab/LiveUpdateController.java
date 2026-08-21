package dev.sysflow.collab;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.Map;

/**
 * Pure relay, no server-side state: a client sends to /app/project/{id}/broadcast and every
 * other subscriber of /topic/project/{id} (including the sender - clients filter out their
 * own clientId) receives it verbatim. The server never interprets or merges payloads; the
 * whole-document last-write-wins resolution happens client-side (see frontend/src/lib/collab.ts).
 *
 * This is deliberately not a CRDT or per-field merge: two people editing different nodes within
 * the same debounce window will have one edit overwrite the other's concurrent change, since
 * each broadcast carries the *entire* graph snapshot. That trade-off is intentional - a simple
 * mechanism that's fully correct beats a fancier one that might not be.
 */
@Controller
public class LiveUpdateController {

    private final SimpMessagingTemplate messagingTemplate;

    public LiveUpdateController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/project/{projectId}/broadcast")
    public void broadcast(@DestinationVariable String projectId, Map<String, Object> message) {
        messagingTemplate.convertAndSend("/topic/project/" + projectId, message);
    }
}

package dev.sysflow.project;

import dev.sysflow.auth.User;
import dev.sysflow.auth.UserRepository;
import dev.sysflow.project.dto.NodeCommentRequest;
import dev.sysflow.project.dto.NodeCommentResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/**
 * Lightweight per-node comment threads on a saved project — async review notes, not a
 * chat. Nested under /api/projects/** so SecurityConfig's existing auth requirement covers
 * it automatically. Viewers can read comments; owners and editors can add or remove them.
 */
@RestController
@RequestMapping("/api/projects/{projectId}/comments")
public class NodeCommentController {

    private final NodeCommentRepository nodeCommentRepository;
    private final ProjectAccessService access;
    private final UserRepository userRepository;

    public NodeCommentController(
            NodeCommentRepository nodeCommentRepository,
            ProjectAccessService access,
            UserRepository userRepository
    ) {
        this.nodeCommentRepository = nodeCommentRepository;
        this.access = access;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<NodeCommentResponse> list(@PathVariable UUID projectId, Authentication auth) {
        access.requireView(projectId, userId(auth));
        return nodeCommentRepository.findByProjectIdOrderByCreatedAtAsc(projectId).stream()
                .map(c -> new NodeCommentResponse(c.getId(), c.getNodeId(), c.getAuthorName(), c.getText(), c.getCreatedAt()))
                .toList();
    }

    @PostMapping
    public NodeCommentResponse create(@PathVariable UUID projectId, @Valid @RequestBody NodeCommentRequest request, Authentication auth) {
        UUID uid = userId(auth);
        access.requireEdit(projectId, uid);
        String authorName = userRepository.findById(uid).map(User::getDisplayName).orElse("Unknown");
        NodeComment comment = new NodeComment(projectId, request.nodeId(), authorName, request.text());
        nodeCommentRepository.save(comment);
        return new NodeCommentResponse(comment.getId(), comment.getNodeId(), comment.getAuthorName(), comment.getText(), comment.getCreatedAt());
    }

    @DeleteMapping("/{commentId}")
    public void delete(@PathVariable UUID projectId, @PathVariable UUID commentId, Authentication auth) {
        access.requireEdit(projectId, userId(auth));
        NodeComment comment = nodeCommentRepository.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found"));
        if (!comment.getProjectId().equals(projectId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found");
        }
        nodeCommentRepository.delete(comment);
    }

    private UUID userId(Authentication auth) {
        return UUID.fromString(auth.getName());
    }
}

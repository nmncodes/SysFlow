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
 * it automatically. Same ownership model as the rest of ProjectController: comments are
 * scoped to the project owner, not shared with live-collaboration guests (those join by
 * project id over WebSocket without an account).
 */
@RestController
@RequestMapping("/api/projects/{projectId}/comments")
public class NodeCommentController {

    private final NodeCommentRepository nodeCommentRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;

    public NodeCommentController(
            NodeCommentRepository nodeCommentRepository,
            ProjectRepository projectRepository,
            UserRepository userRepository
    ) {
        this.nodeCommentRepository = nodeCommentRepository;
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<NodeCommentResponse> list(@PathVariable UUID projectId, Authentication auth) {
        findOwnedProject(projectId, userId(auth));
        return nodeCommentRepository.findByProjectIdOrderByCreatedAtAsc(projectId).stream()
                .map(c -> new NodeCommentResponse(c.getId(), c.getNodeId(), c.getAuthorName(), c.getText(), c.getCreatedAt()))
                .toList();
    }

    @PostMapping
    public NodeCommentResponse create(@PathVariable UUID projectId, @Valid @RequestBody NodeCommentRequest request, Authentication auth) {
        UUID uid = userId(auth);
        findOwnedProject(projectId, uid);
        String authorName = userRepository.findById(uid).map(User::getDisplayName).orElse("Unknown");
        NodeComment comment = new NodeComment(projectId, request.nodeId(), authorName, request.text());
        nodeCommentRepository.save(comment);
        return new NodeCommentResponse(comment.getId(), comment.getNodeId(), comment.getAuthorName(), comment.getText(), comment.getCreatedAt());
    }

    @DeleteMapping("/{commentId}")
    public void delete(@PathVariable UUID projectId, @PathVariable UUID commentId, Authentication auth) {
        findOwnedProject(projectId, userId(auth));
        NodeComment comment = nodeCommentRepository.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found"));
        if (!comment.getProjectId().equals(projectId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found");
        }
        nodeCommentRepository.delete(comment);
    }

    private void findOwnedProject(UUID projectId, UUID userId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));
        if (!project.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found");
        }
    }

    private UUID userId(Authentication auth) {
        return UUID.fromString(auth.getName());
    }
}

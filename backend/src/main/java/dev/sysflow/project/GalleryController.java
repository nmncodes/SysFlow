package dev.sysflow.project;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.sysflow.auth.User;
import dev.sysflow.auth.UserRepository;
import dev.sysflow.project.dto.GalleryItemResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Read-only, unauthenticated list of community-published architectures - opt-in only
 * (Project.isPublicTemplate), separate from the built-in starter templates in
 * frontend/src/lib/templates.ts. Detail fetch reuses PublicProjectController's
 * existing /api/public/projects/{id}, since a gallery-listed project is by
 * definition also fine to fetch that way.
 */
@RestController
@RequestMapping("/api/gallery")
public class GalleryController {

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public GalleryController(ProjectRepository projectRepository, UserRepository userRepository, ObjectMapper objectMapper) {
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    private static final int MAX_GALLERY_ITEMS = 100;

    @GetMapping
    public List<GalleryItemResponse> list() {
        List<Project> projects = projectRepository.findByIsPublicTemplateTrueOrderByUpdatedAtDesc().stream()
                .limit(MAX_GALLERY_ITEMS)
                .toList();
        if (projects.isEmpty()) return List.of();
        Set<UUID> userIds = projects.stream().map(Project::getUserId).collect(java.util.stream.Collectors.toSet());
        Map<UUID, String> names = userRepository.findAllById(userIds).stream()
                .collect(java.util.stream.Collectors.toMap(User::getId, u -> u.getDisplayName() != null && !u.getDisplayName().isBlank() ? u.getDisplayName() : "SysFlow user"));
        return projects.stream().map(p -> new GalleryItemResponse(
                p.getId(), p.getName(), p.getDescription(),
                names.getOrDefault(p.getUserId(), "SysFlow user"),
                countNodes(p.getGraphJson()), p.getUpdatedAt()
        )).toList();
    }

    private int countNodes(String graphJson) {
        try {
            JsonNode graph = objectMapper.readTree(graphJson);
            return graph.path("nodes").size();
        } catch (Exception e) {
            return 0;
        }
    }
}

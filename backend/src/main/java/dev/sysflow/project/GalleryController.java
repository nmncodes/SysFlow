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

/**
 * Read-only, unauthenticated list of community-published architectures — opt-in only
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

    @GetMapping
    public List<GalleryItemResponse> list() {
        return projectRepository.findByIsPublicTemplateTrueOrderByUpdatedAtDesc().stream()
                .map(this::toItem)
                .toList();
    }

    private GalleryItemResponse toItem(Project project) {
        String authorName = userRepository.findById(project.getUserId())
                .map(User::getDisplayName)
                .filter(name -> name != null && !name.isBlank())
                .orElse("SysFlow user");
        int nodeCount = countNodes(project.getGraphJson());
        return new GalleryItemResponse(project.getId(), project.getName(), project.getDescription(), authorName, nodeCount, project.getUpdatedAt());
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

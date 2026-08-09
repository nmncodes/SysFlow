package dev.sysflow.project;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Phase 6 TODO: real CRUD backed by Postgres per docs/04-DATA-MODEL-AND-API.md.
 */
@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    @GetMapping
    public List<Map<String, Object>> list() {
        return List.of();
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody Map<String, Object> request) {
        return Map.of("id", "stub", "note", "project persistence not yet implemented — see docs/05-ROADMAP.md Phase 6");
    }
}

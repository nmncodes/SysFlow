package dev.sysflow.simulation;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Phase 2 TODO: replace with the real tick-based engine described in
 * docs/02-ARCHITECTURE.md §4. This stub only proves the request/response
 * contract from docs/04-DATA-MODEL-AND-API.md so the frontend can integrate early.
 */
@RestController
@RequestMapping("/api/simulations")
public class SimulationController {

    @PostMapping("/run")
    public Map<String, Object> run(@RequestBody Map<String, Object> request) {
        return Map.of(
                "ticks", java.util.List.of(),
                "summary", Map.of("note", "simulation engine not yet implemented — see docs/05-ROADMAP.md Phase 2")
        );
    }
}

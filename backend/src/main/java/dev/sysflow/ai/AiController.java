package dev.sysflow.ai;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Phase 5 TODO: implement rule-based static analysis + Gemini synthesis
 * per docs/02-ARCHITECTURE.md §5. Stub proves the contract only.
 */
@RestController
@RequestMapping("/api/ai")
public class AiController {

    @PostMapping("/analyze")
    public Map<String, Object> analyze(@RequestBody Map<String, Object> request) {
        return Map.of("findings", List.of());
    }
}

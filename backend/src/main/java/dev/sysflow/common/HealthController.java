package dev.sysflow.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class HealthController {

    private final DataSource dataSource;
    private final boolean geminiConfigured;

    public HealthController(DataSource dataSource, @Value("${gemini.api-key:}") String geminiApiKey) {
        this.dataSource = dataSource;
        this.geminiConfigured = geminiApiKey != null && !geminiApiKey.isBlank();
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> checks = new LinkedHashMap<>();
        checks.put("database", checkDatabase());
        checks.put("aiAdvisory", geminiConfigured ? "configured" : "unconfigured (rule-based findings only)");

        boolean healthy = "up".equals(checks.get("database"));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", healthy ? "ok" : "degraded");
        body.put("service", "sysflow-backend");
        body.put("checks", checks);
        return body;
    }

    private String checkDatabase() {
        try (Connection connection = dataSource.getConnection()) {
            return connection.isValid(2) ? "up" : "down";
        } catch (Exception e) {
            return "down";
        }
    }
}

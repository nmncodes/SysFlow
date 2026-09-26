package dev.sysflow.interview.dto;

import java.util.List;

public record GradeResponse(
        int overallScore,
        List<CategoryScore> categories,
        String summary,
        List<String> improvements,
        boolean aiEnabled
) {
    public record CategoryScore(String name, int score, int maxScore, String feedback) {
    }
}

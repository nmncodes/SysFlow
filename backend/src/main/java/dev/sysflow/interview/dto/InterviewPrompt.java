package dev.sysflow.interview.dto;

import java.util.List;

public record InterviewPrompt(String id, String title, String difficulty, String brief, List<String> keyConsiderations) {
}

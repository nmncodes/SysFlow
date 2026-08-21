package dev.sysflow.interview;

import dev.sysflow.interview.dto.GradeRequest;
import dev.sysflow.interview.dto.GradeResponse;
import dev.sysflow.interview.dto.InterviewPrompt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * System-design interview practice mode: a static prompt bank plus AI grading of a
 * submitted architecture against each prompt's brief. Unauthenticated, same as the
 * rest of the try-before-you-sign-up editor experience.
 */
@RestController
@RequestMapping("/api/interview")
public class InterviewController {

    private final InterviewGrader grader;

    public InterviewController(InterviewGrader grader) {
        this.grader = grader;
    }

    @GetMapping("/prompts")
    public List<InterviewPrompt> prompts() {
        return InterviewPrompts.all();
    }

    @PostMapping("/grade")
    public GradeResponse grade(@RequestBody GradeRequest request) {
        InterviewPrompt prompt = InterviewPrompts.byId(request.promptId());
        if (prompt == null) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Unknown prompt: " + request.promptId());
        }
        if (request.graphJson() == null || request.graphJson().nodes().isEmpty()) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Build something before submitting for grading.");
        }
        return grader.grade(prompt, request.graphJson());
    }
}

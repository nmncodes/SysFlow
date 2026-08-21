package dev.sysflow.interview;

import dev.sysflow.interview.dto.InterviewPrompt;

import java.util.List;
import java.util.Map;

/** Static prompt bank — single source of truth for both the prompt list and grading context. */
public final class InterviewPrompts {

    private static final List<InterviewPrompt> PROMPTS = List.of(
            new InterviewPrompt(
                    "url-shortener", "Design a URL Shortener", "Easy",
                    "Design a service like bit.ly: users submit a long URL and get back a short one; visiting the short URL redirects to the original. Must handle a high read:write ratio (far more redirects than URLs created) and guarantee short codes never collide.",
                    List.of("Short-code generation strategy and collision avoidance", "Redirect latency at scale (read-heavy)", "Handling a long-tail of unpopular vs. hot links")
            ),
            new InterviewPrompt(
                    "rate-limiter", "Design a Distributed Rate Limiter", "Medium",
                    "Design a rate limiter that enforces a per-user (or per-API-key) request limit (e.g. 100 requests/minute) across many stateless application servers behind a load balancer, so the limit is correct even though requests land on different servers.",
                    List.of("Where limiter state lives so it's consistent across servers", "Latency cost of checking the limit on every request", "Behavior under the rate-limiting store's own failure")
            ),
            new InterviewPrompt(
                    "news-feed", "Design a Social Media News Feed", "Hard",
                    "Design the system that generates a user's home feed from posts made by people they follow, at a scale where some accounts have millions of followers. Feed must be reasonably fresh and load fast.",
                    List.of("Fan-out-on-write vs. fan-out-on-read trade-off (and hybrid for celebrity accounts)", "Where feed data is cached/stored per user", "Async processing for post distribution")
            ),
            new InterviewPrompt(
                    "chat-app", "Design a Real-Time Chat Application", "Medium",
                    "Design a chat app (like WhatsApp) supporting 1:1 messaging: messages should be delivered in near-real-time when the recipient is online, and reliably queued for delivery when they're offline.",
                    List.of("Real-time delivery mechanism to an online client", "Durable storage and delivery guarantees for offline users", "Presence (online/offline) tracking")
            ),
            new InterviewPrompt(
                    "video-streaming", "Design a Video Streaming Service", "Hard",
                    "Design the upload-to-playback pipeline for a video platform (like YouTube): creators upload raw video, it needs to become streamable in multiple qualities, and viewers worldwide need low-latency playback.",
                    List.of("Async transcoding pipeline after upload", "Global low-latency delivery of the processed video", "Storage cost/tiering for a huge, mostly-cold video catalog")
            ),
            new InterviewPrompt(
                    "ecommerce-checkout", "Design an E-Commerce Checkout System", "Hard",
                    "Design the checkout flow for an online store: a customer adds items to a cart, checks out, and pays. Must prevent overselling out-of-stock items and keep orders consistent even if the payment step fails partway through.",
                    List.of("Inventory consistency under concurrent checkouts", "Payment failure/partial-failure handling", "Order state machine and idempotency on retries")
            )
    );

    private static final Map<String, InterviewPrompt> BY_ID = PROMPTS.stream()
            .collect(java.util.stream.Collectors.toMap(InterviewPrompt::id, p -> p));

    public static List<InterviewPrompt> all() {
        return PROMPTS;
    }

    public static InterviewPrompt byId(String id) {
        return BY_ID.get(id);
    }

    private InterviewPrompts() {
    }
}

package dev.sysflow.interview;

import dev.sysflow.interview.dto.InterviewPrompt;

import java.util.List;
import java.util.Map;

public final class InterviewPrompts {

    private static final List<InterviewPrompt> PROMPTS = List.of(
            new InterviewPrompt(
                    "url-shortener", "Design a URL Shortener", "Easy",
                    "Design a service like bit.ly: users submit a long URL and get back a short one; visiting the short URL redirects to the original. Must handle a high read:write ratio (far more redirects than URLs created) and guarantee short codes never collide.",
                    List.of("Short-code generation strategy and collision avoidance", "Redirect latency at scale (read-heavy)", "Handling a long-tail of unpopular vs. hot links"),
                    List.of("Client", "API Gateway", "Load Balancer", "URL Service", "Cache (Redis)", "Database (SQL/NoSQL)", "CDN"),
                    List.of("Base62 encoding or MD5/SHA hash truncation for short codes", "301 vs 302 redirect semantics and caching implications", "DB schema: urls(id, short_code UNIQUE, original_url, created_at, expires_at)", "Read-through cache with TTL for hot URLs", "API: POST /urls {longUrl} -> {shortUrl}, GET /:code -> 301 redirect", "Rate limiting on create endpoint to prevent abuse")
            ),
            new InterviewPrompt(
                    "rate-limiter", "Design a Distributed Rate Limiter", "Medium",
                    "Design a rate limiter that enforces a per-user (or per-API-key) request limit (e.g. 100 req/min) across many stateless application servers behind a load balancer, so the limit is correct even though requests land on different servers.",
                    List.of("Where limiter state lives so it's consistent across servers", "Latency cost of checking the limit on every request", "Behavior under the rate-limiting store's own failure"),
                    List.of("API Gateway", "Load Balancer", "Application Servers", "Redis Cluster", "Config Service", "Monitoring/Alerting"),
                    List.of("Token bucket vs sliding window vs fixed window algorithms", "Lua script in Redis for atomic check-and-decrement", "Schema: rate_limits(api_key, window_start, count) or Redis key rate:{key}:{window}", "HTTP 429 response with Retry-After and X-RateLimit-* headers", "Fail-open vs fail-closed when Redis is unreachable", "Per-tier limits: free=100/min, pro=1000/min, enterprise=custom")
            ),
            new InterviewPrompt(
                    "news-feed", "Design a Social Media News Feed", "Hard",
                    "Design the system that generates a user's home feed from posts made by people they follow, at a scale where some accounts have millions of followers. Feed must be reasonably fresh and load fast.",
                    List.of("Fan-out-on-write vs. fan-out-on-read trade-off (and hybrid for celebrity accounts)", "Where feed data is cached/stored per user", "Async processing for post distribution"),
                    List.of("Client", "API Gateway", "Load Balancer", "Post Service", "Feed Service", "Fan-out Workers", "Message Queue (Kafka)", "Cache (Redis)", "Database (Cassandra/DynamoDB)", "Social Graph Service", "CDN", "Object Storage (S3)"),
                    List.of("Fan-out-on-write: write to each follower's feed list on post creation", "Hybrid: fan-out-on-write for normal users, fan-out-on-read for celebrities (>500k followers)", "Feed table: user_feeds(user_id, post_id, author_id, created_at) - partition by user_id", "Denormalize post content into feed entries to avoid join at read time", "Cursor-based pagination: GET /feed?cursor={last_post_id}&limit=20", "Ranking: chronological base with engagement-weighted re-ranking")
            ),
            new InterviewPrompt(
                    "chat-app", "Design a Real-Time Chat Application", "Medium",
                    "Design a chat app (like WhatsApp) supporting 1:1 messaging: messages should be delivered in near-real-time when the recipient is online, and reliably queued for delivery when they're offline.",
                    List.of("Real-time delivery mechanism to an online client", "Durable storage and delivery guarantees for offline users", "Presence (online/offline) tracking"),
                    List.of("Client (Mobile/Web)", "Load Balancer (L4)", "WebSocket Gateway", "Chat Service", "Presence Service", "Message Queue (Kafka)", "Database (Cassandra)", "Cache (Redis)", "Push Notification Service (APNs/FCM)", "Object Storage (S3)"),
                    List.of("WebSocket connections for real-time bidirectional messaging", "Message states: sent -> delivered -> read with per-message ACKs", "Messages table: messages(chat_id, msg_id, sender_id, content, timestamp) - partition by chat_id", "Heartbeat-based presence: client pings every 30s, timeout = offline", "Offline queue: undelivered messages stored in DB, flushed on reconnect", "End-to-end encryption: Signal protocol with per-session key exchange")
            ),
            new InterviewPrompt(
                    "video-streaming", "Design a Video Streaming Service", "Hard",
                    "Design the upload-to-playback pipeline for a video platform (like YouTube): creators upload raw video, it needs to become streamable in multiple qualities, and viewers worldwide need low-latency playback.",
                    List.of("Async transcoding pipeline after upload", "Global low-latency delivery of the processed video", "Storage cost/tiering for a huge, mostly-cold video catalog"),
                    List.of("Client", "API Gateway", "Upload Service", "Object Storage (S3)", "Message Queue (SQS/Kafka)", "Transcoding Workers (GPU)", "CDN (Global PoPs)", "Metadata Service", "Database (PostgreSQL)", "Search Service (Elasticsearch)", "Thumbnail Generator", "Analytics Pipeline"),
                    List.of("Chunked/resumable upload via tus protocol or multipart S3", "Transcoding DAG: raw -> 1080p/720p/480p/360p + HLS/DASH segments", "HLS manifest: .m3u8 playlist with adaptive bitrate switching", "Videos table: videos(id, owner_id, title, status, duration, storage_key)", "Cold storage tiering: S3 Standard -> S3-IA -> Glacier for old videos", "API: POST /videos/upload -> presigned URL, GET /videos/:id/manifest -> .m3u8")
            ),
            new InterviewPrompt(
                    "ecommerce-checkout", "Design an E-Commerce Checkout System", "Hard",
                    "Design the checkout flow for an online store: a customer adds items to a cart, checks out, and pays. Must prevent overselling out-of-stock items and keep orders consistent even if the payment step fails partway through.",
                    List.of("Inventory consistency under concurrent checkouts", "Payment failure/partial-failure handling", "Order state machine and idempotency on retries"),
                    List.of("Client", "API Gateway", "Cart Service", "Order Service", "Inventory Service", "Payment Service (Stripe/PayPal)", "Message Queue", "Database (PostgreSQL)", "Cache (Redis)", "Notification Service (Email/SMS)"),
                    List.of("Pessimistic locking: SELECT FOR UPDATE on inventory rows during checkout", "Order state machine: CREATED -> RESERVED -> PAYMENT_PENDING -> CONFIRMED -> SHIPPED", "Saga pattern: reserve inventory -> charge payment -> confirm order (compensate on failure)", "Idempotency key on payment requests to prevent double-charging", "Orders table: orders(id, user_id, status, total, idempotency_key, created_at)", "Cart expiry: reserved inventory released after 15 min if checkout not completed")
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

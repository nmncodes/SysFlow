package dev.sysflow.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.LongSupplier;

/**
 * Fixed-window per-client limit for unauthenticated endpoints that can call
 * paid or otherwise abusable services. Forwarded addresses are used only when
 * the immediate peer matches an explicitly configured trusted proxy CIDR.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> LIMITED_PATHS = Set.of(
            "/api/ai/analyze", "/api/srs/import", "/api/pricing/estimate", "/api/pricing/compare", "/api/interview/grade");
    private static final int MAX_REQUESTS_PER_WINDOW = 20;
    private static final long WINDOW_MILLIS = 60_000;
    private static final int MAX_BUCKETS = 10_000;

    private final List<IpNetwork> trustedProxies;
    private final int maxBuckets;
    private final long windowMillis;
    private final LongSupplier clock;
    private final Map<String, Window> windows = new LinkedHashMap<>(128, 0.75f, true);
    private long lastCleanupAt;

    @Autowired
    public RateLimitFilter(@Value("${rate-limit.trusted-proxies:}") String trustedProxyCidrs) {
        this(trustedProxyCidrs, MAX_BUCKETS, WINDOW_MILLIS, () -> System.nanoTime() / 1_000_000L);
    }

    RateLimitFilter(String trustedProxyCidrs, int maxBuckets, long windowMillis, LongSupplier clock) {
        if (maxBuckets < 1 || windowMillis < 1) {
            throw new IllegalArgumentException("Rate-limit bucket capacity and window must be positive");
        }
        this.trustedProxies = parseNetworks(trustedProxyCidrs);
        this.maxBuckets = maxBuckets;
        this.windowMillis = windowMillis;
        this.clock = clock;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!LIMITED_PATHS.contains(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        long now = clock.getAsLong();
        String key = clientIp(request) + ":" + path;
        LimitDecision decision = recordRequest(key, now);

        response.setHeader("X-RateLimit-Limit", String.valueOf(MAX_REQUESTS_PER_WINDOW));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(decision.remaining()));
        response.setHeader("X-RateLimit-Reset", String.valueOf(decision.resetInSeconds()));

        if (decision.limited()) {
            response.setHeader("Retry-After", String.valueOf(Math.max(1, decision.resetInSeconds())));
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Too many requests — please wait a moment and try again.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private synchronized LimitDecision recordRequest(String key, long now) {
        if (now - lastCleanupAt >= windowMillis) {
            removeExpired(now);
            lastCleanupAt = now;
        }

        Window window = windows.get(key);
        if (window == null) {
            if (windows.size() >= maxBuckets) {
                removeExpired(now);
                if (windows.size() >= maxBuckets) {
                    long earliestExpiry = windows.values().stream()
                            .mapToLong(entry -> entry.startedAt + windowMillis)
                            .min()
                            .orElse(now + windowMillis);
                    long retryAfter = Math.max(1, (earliestExpiry - now + 999) / 1000);
                    return new LimitDecision(true, 0, retryAfter);
                }
            }
            window = new Window(now);
            windows.put(key, window);
        } else if (now - window.startedAt >= windowMillis) {
            window.startedAt = now;
            window.count = 0;
        }

        window.count++;
        long resetInSeconds = Math.max(0, (window.startedAt + windowMillis - now) / 1000);
        return new LimitDecision(window.count > MAX_REQUESTS_PER_WINDOW,
                Math.max(0, MAX_REQUESTS_PER_WINDOW - window.count), resetInSeconds);
    }

    private void removeExpired(long now) {
        Iterator<Window> iterator = windows.values().iterator();
        while (iterator.hasNext()) {
            if (now - iterator.next().startedAt >= windowMillis) iterator.remove();
        }
    }

    private String clientIp(HttpServletRequest request) {
        String remoteAddress = normalizeIp(request.getRemoteAddr());
        if (remoteAddress == null || trustedProxies.isEmpty() || !isTrusted(remoteAddress)) {
            return remoteAddress == null ? "unknown" : remoteAddress;
        }

        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded == null || forwarded.isBlank()) return remoteAddress;

        List<String> hops = Arrays.stream(forwarded.split(",", -1))
                .map(String::trim)
                .toList();
        if (hops.stream().anyMatch(hop -> normalizeIp(hop) == null)) return remoteAddress;

        // Walk from the trusted immediate peer toward the client, skipping only
        // proxies we explicitly trust. Never accept an arbitrary leftmost value.
        for (int i = hops.size() - 1; i >= 0; i--) {
            String hop = normalizeIp(hops.get(i));
            if (!isTrusted(hop)) return hop;
        }
        return normalizeIp(hops.get(0));
    }

    private boolean isTrusted(String address) {
        return trustedProxies.stream().anyMatch(network -> network.contains(address));
    }

    private static List<IpNetwork> parseNetworks(String cidrs) {
        if (cidrs == null || cidrs.isBlank()) return List.of();
        List<IpNetwork> networks = new ArrayList<>();
        for (String entry : cidrs.split(",")) {
            String cidr = entry.trim();
            if (cidr.isEmpty()) continue;
            String[] parts = cidr.split("/", -1);
            String address = normalizeIp(parts[0]);
            if (parts.length > 2 || address == null) {
                throw new IllegalArgumentException("Invalid trusted proxy CIDR: " + cidr);
            }
            byte[] bytes = parseAddress(address);
            int maxPrefix = bytes.length * 8;
            int prefix;
            try {
                prefix = parts.length == 1 ? maxPrefix : Integer.parseInt(parts[1]);
            } catch (NumberFormatException exception) {
                throw new IllegalArgumentException("Invalid trusted proxy CIDR: " + cidr, exception);
            }
            if (prefix < 0 || prefix > maxPrefix) {
                throw new IllegalArgumentException("Invalid trusted proxy CIDR: " + cidr);
            }
            networks.add(new IpNetwork(bytes, prefix));
        }
        return List.copyOf(networks);
    }

    private static String normalizeIp(String value) {
        if (value == null || value.isBlank()) return null;
        String candidate = value.trim();
        if (!candidate.matches("[0-9a-fA-F:.]+") || candidate.indexOf(':') < 0 && !candidate.matches("[0-9.]+")) {
            return null;
        }
        try {
            return InetAddress.getByName(candidate).getHostAddress();
        } catch (UnknownHostException exception) {
            return null;
        }
    }

    private static byte[] parseAddress(String address) {
        try {
            return InetAddress.getByName(address).getAddress();
        } catch (UnknownHostException exception) {
            throw new IllegalArgumentException("Invalid IP address: " + address, exception);
        }
    }

    private record LimitDecision(boolean limited, long remaining, long resetInSeconds) {}

    private static final class Window {
        private long startedAt;
        private long count;

        private Window(long startedAt) {
            this.startedAt = startedAt;
        }
    }

    private record IpNetwork(byte[] address, int prefixLength) {
        private boolean contains(String candidate) {
            byte[] other = parseAddress(candidate);
            if (address.length != other.length) return false;
            int fullBytes = prefixLength / 8;
            int remainingBits = prefixLength % 8;
            for (int i = 0; i < fullBytes; i++) {
                if (address[i] != other[i]) return false;
            }
            if (remainingBits == 0) return true;
            int mask = 0xff << (8 - remainingBits);
            return (address[fullBytes] & mask) == (other[fullBytes] & mask);
        }
    }
}

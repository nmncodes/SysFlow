package dev.sysflow.common;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;

class RateLimitFilterTest {

    private static final String LIMITED_PATH = "/api/ai/analyze";

    @Test
    void ignoresForwardedHeadersFromUntrustedPeers() throws Exception {
        RateLimitFilter filter = new RateLimitFilter("10.0.0.0/8", 100, 60_000, System::currentTimeMillis);
        MockHttpServletResponse lastResponse = null;

        for (int i = 0; i < 21; i++) {
            MockHttpServletRequest request = request("203.0.113.8", "198.51.100." + i);
            lastResponse = invoke(filter, request);
        }

        assertNotNull(lastResponse);
        assertEquals(429, lastResponse.getStatus(), "changing an untrusted X-Forwarded-For header must not bypass the limit");
    }

    @Test
    void resolvesTheClientFromTheTrustedProxyChain() throws Exception {
        RateLimitFilter filter = new RateLimitFilter("10.0.0.0/8", 100, 60_000, System::currentTimeMillis);
        MockHttpServletResponse lastResponse = null;

        for (int i = 0; i < 21; i++) {
            MockHttpServletRequest request = request("10.1.2.3", "198.51.100.9, 10.2.3.4");
            lastResponse = invoke(filter, request);
        }

        assertNotNull(lastResponse);
        assertEquals(429, lastResponse.getStatus(), "the trusted proxy chain should resolve to the same client despite spoofed prefixes");
    }

    @Test
    void boundsBucketMemoryAndExpiresOldEntries() throws Exception {
        AtomicLong now = new AtomicLong(1_000);
        RateLimitFilter filter = new RateLimitFilter("", 1, 1_000, now::get);

        assertEquals(200, invoke(filter, request("192.0.2.1", null)).getStatus());
        assertEquals(429, invoke(filter, request("192.0.2.2", null)).getStatus(), "new identities are rejected while the bounded table is full");

        now.addAndGet(1_001);
        assertEquals(200, invoke(filter, request("192.0.2.2", null)).getStatus(), "expired entries are reclaimed before rejecting a new identity");
    }

    @Test
    void doesNotLimitUnconfiguredEndpoints() throws Exception {
        RateLimitFilter filter = new RateLimitFilter("", 1, 60_000, System::currentTimeMillis);
        MockHttpServletRequest request = request("192.0.2.1", null);
        request.setRequestURI("/api/health");
        AtomicInteger calls = new AtomicInteger();

        MockHttpServletResponse response = invoke(filter, request, (req, res) -> calls.incrementAndGet());

        assertEquals(200, response.getStatus());
        assertEquals(1, calls.get());
        assertNull(response.getHeader("X-RateLimit-Limit"));
    }

    @Test
    void rejectsMalformedTrustedProxyConfiguration() {
        assertThrows(IllegalArgumentException.class,
                () -> new RateLimitFilter("not-an-ip", 10, 1_000, System::currentTimeMillis));
    }

    private MockHttpServletRequest request(String remoteAddress, String forwardedFor) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI(LIMITED_PATH);
        request.setRemoteAddr(remoteAddress);
        if (forwardedFor != null) request.addHeader("X-Forwarded-For", forwardedFor);
        return request;
    }

    private MockHttpServletResponse invoke(RateLimitFilter filter, MockHttpServletRequest request) throws Exception {
        return invoke(filter, request, (req, res) -> {});
    }

    private MockHttpServletResponse invoke(RateLimitFilter filter, MockHttpServletRequest request, FilterChain chain) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        return response;
    }
}

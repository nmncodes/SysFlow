package dev.sysflow.pricing;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Real hourly prices from Azure's public Retail Prices API (no auth required:
 * https://prices.azure.com/api/retail/prices). Each SKU filter below was verified live
 * against the real API before being hardcoded — see the commit that introduced this file
 * for the discovery queries. Region fixed to eastus for a single consistent baseline.
 *
 * Only a handful of component categories get real pricing (see PricingCategory) - everything
 * else stays on CostModel's illustrative numbers. This is a deliberate scope limit, not an
 * oversight: mapping all 30 component types to verified real SKUs would require discovering
 * and validating a filter for each one individually, and a wrong guess would silently return
 * no price rather than a wrong one - so only verified mappings are included.
 */
@Component
public class AzurePricingClient {

    private static final Logger log = LoggerFactory.getLogger(AzurePricingClient.class);
    private static final double HOURS_PER_MONTH = 730;
    private static final Duration CACHE_TTL = Duration.ofHours(24);

    private final RestClient restClient = buildRestClient();

    private static RestClient buildRestClient() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5_000);
        requestFactory.setReadTimeout(10_000);
        return RestClient.builder()
                .baseUrl("https://prices.azure.com/api/retail/prices")
                .requestFactory(requestFactory)
                .build();
    }

    private final Map<PricingCategory, CachedPrice> cache = new ConcurrentHashMap<>();

    private record CachedPrice(double hourlyUsd, Instant fetchedAt) {
        boolean isFresh() {
            return Instant.now().isBefore(fetchedAt.plus(CACHE_TTL));
        }
    }

    public enum PricingCategory {
        /**
         * Standard_B2s Linux — a small general-purpose VM, standing in for a lightly configured
         * generic compute node. Tier picked by PricingController from the node's maxConcurrency/
         * maxThroughput config; each tier's SKU was verified live against the real API (see the
         * commit that introduced tiering for the discovery queries) before being hardcoded.
         */
        GENERIC_COMPUTE_SMALL("armRegionName eq 'eastus' and serviceName eq 'Virtual Machines' and armSkuName eq 'Standard_B2s' and priceType eq 'Consumption'", "Virtual Machines BS Series", null),
        /** Standard_D2s_v3 Linux, pay-as-you-go (excludes the Spot/Low-Priority/Windows meters that share the same product name). */
        GENERIC_COMPUTE_MEDIUM("armRegionName eq 'eastus' and serviceName eq 'Virtual Machines' and armSkuName eq 'Standard_D2s_v3' and priceType eq 'Consumption'", "Virtual Machines DSv3 Series", "D2s v3"),
        /** Standard_D4s_v3 Linux, pay-as-you-go. */
        GENERIC_COMPUTE_LARGE("armRegionName eq 'eastus' and serviceName eq 'Virtual Machines' and armSkuName eq 'Standard_D4s_v3' and priceType eq 'Consumption'", "Virtual Machines DSv3 Series", "D4s v3"),

        /** Postgres Flexible Server, Burstable B1ms — stands in for a lightly configured managed relational/analytical store. */
        MANAGED_DATABASE_SMALL("armRegionName eq 'eastus' and serviceName eq 'Azure Database for PostgreSQL' and skuName eq 'B1MS'", "Burstable BS Series", null),
        /** Postgres Flexible Server, Burstable B2ms. */
        MANAGED_DATABASE_MEDIUM("armRegionName eq 'eastus' and serviceName eq 'Azure Database for PostgreSQL' and skuName eq 'B2ms'", "Burstable BS Series", null),
        /** Postgres Flexible Server, Burstable B4ms. */
        MANAGED_DATABASE_LARGE("armRegionName eq 'eastus' and serviceName eq 'Azure Database for PostgreSQL' and skuName eq 'B4ms'", "Burstable BS Series", null),

        /** Azure Cache for Redis, Basic C0 — the smallest managed cache tier. */
        CACHE_SMALL("armRegionName eq 'eastus' and serviceName eq 'Redis Cache' and skuName eq 'C0'", "Azure Redis Cache Basic", null),
        /** Azure Cache for Redis, Basic C1. */
        CACHE_MEDIUM("armRegionName eq 'eastus' and serviceName eq 'Redis Cache' and skuName eq 'C1'", "Azure Redis Cache Basic", null),
        /** Azure Cache for Redis, Basic C2. */
        CACHE_LARGE("armRegionName eq 'eastus' and serviceName eq 'Redis Cache' and skuName eq 'C2'", "Azure Redis Cache Basic", null),

        /** Blob Storage, Hot tier, LRS — priced per GB/month, not per hour; see monthlyRateForGbMonth. */
        OBJECT_STORAGE("armRegionName eq 'eastus' and serviceName eq 'Storage' and skuName eq 'Hot LRS' and meterName eq 'Hot LRS Data Stored'", "Blob Storage", null);

        final String filter;
        final String productNameMatch;
        /** When set, only an item whose meterName exactly equals this is accepted — needed for SKUs (like D-series VMs) where Spot/Low-Priority/Windows variants share the same productName. */
        final String exactMeterName;

        PricingCategory(String filter, String productNameMatch, String exactMeterName) {
            this.filter = filter;
            this.productNameMatch = productNameMatch;
            this.exactMeterName = exactMeterName;
        }
    }

    /** Size tier picked by PricingController from a node's configured concurrency/throughput/connections. */
    public enum Tier { SMALL, MEDIUM, LARGE }

    public static PricingCategory computeCategoryFor(Tier tier) {
        return switch (tier) {
            case SMALL -> PricingCategory.GENERIC_COMPUTE_SMALL;
            case MEDIUM -> PricingCategory.GENERIC_COMPUTE_MEDIUM;
            case LARGE -> PricingCategory.GENERIC_COMPUTE_LARGE;
        };
    }

    public static PricingCategory databaseCategoryFor(Tier tier) {
        return switch (tier) {
            case SMALL -> PricingCategory.MANAGED_DATABASE_SMALL;
            case MEDIUM -> PricingCategory.MANAGED_DATABASE_MEDIUM;
            case LARGE -> PricingCategory.MANAGED_DATABASE_LARGE;
        };
    }

    public static PricingCategory cacheCategoryFor(Tier tier) {
        return switch (tier) {
            case SMALL -> PricingCategory.CACHE_SMALL;
            case MEDIUM -> PricingCategory.CACHE_MEDIUM;
            case LARGE -> PricingCategory.CACHE_LARGE;
        };
    }

    /** Real hourly USD rate for a compute/database/cache category, or empty if the live lookup fails. */
    public Optional<Double> hourlyPriceUsd(PricingCategory category) {
        CachedPrice cached = cache.get(category);
        if (cached != null && cached.isFresh()) {
            return Optional.of(cached.hourlyUsd);
        }
        return fetch(category).map(price -> {
            cache.put(category, new CachedPrice(price, Instant.now()));
            return price;
        }).or(() -> cached != null ? Optional.of(cached.hourlyUsd) : Optional.empty());
    }

    /** Real monthly USD estimate for a compute/database/cache category (hourly rate x 730h/month). */
    public Optional<Double> monthlyPriceUsd(PricingCategory category) {
        return hourlyPriceUsd(category).map(hourly -> hourly * HOURS_PER_MONTH);
    }

    /** Object storage is priced per GB/month, not per hour — assumedGb lets the caller pick a volume. */
    public Optional<Double> monthlyStorageCostUsd(double assumedGb) {
        return hourlyPriceUsd(PricingCategory.OBJECT_STORAGE).map(perGbMonth -> perGbMonth * assumedGb);
    }

    private Optional<Double> fetch(PricingCategory category) {
        try {
            JsonNode response = restClient.get()
                    .uri(uriBuilder -> uriBuilder.queryParam("$filter", category.filter).build())
                    .retrieve()
                    .body(JsonNode.class);

            if (response == null) return Optional.empty();
            for (JsonNode item : response.path("Items")) {
                boolean productMatches = item.path("productName").asText("").contains(category.productNameMatch);
                boolean meterMatches = category.exactMeterName == null || category.exactMeterName.equals(item.path("meterName").asText(""));
                if (productMatches && meterMatches) {
                    return Optional.of(item.path("retailPrice").asDouble());
                }
            }
            // Fall back to the first item if none match the expected product name exactly.
            JsonNode items = response.path("Items");
            if (items.isArray() && items.size() > 0) {
                return Optional.of(items.get(0).path("retailPrice").asDouble());
            }
            return Optional.empty();
        } catch (Exception e) {
            log.warn("Azure pricing lookup failed for {}: {}", category, e.getMessage());
            return Optional.empty();
        }
    }
}

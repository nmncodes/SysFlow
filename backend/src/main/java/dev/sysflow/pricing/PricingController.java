package dev.sysflow.pricing;

import dev.sysflow.common.CostModel;
import dev.sysflow.pricing.dto.PricingEstimateRequest;
import dev.sysflow.pricing.dto.PricingEstimateResponse;
import dev.sysflow.simulation.model.GraphNode;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * POST /api/pricing/estimate — real Azure Retail Prices for the handful of component
 * categories with a verified SKU mapping (see AzurePricingClient), illustrative CostModel
 * numbers for everything else. Every node in the response is tagged with its actual source
 * so the frontend never presents an illustrative guess as if it were real pricing.
 */
@RestController
@RequestMapping("/api/pricing")
public class PricingController {

    /** Assumed data volume for object storage nodes — storage is priced per GB/month, not per instance. */
    private static final double ASSUMED_STORAGE_GB = 100;

    private static final Set<String> GENERIC_COMPUTE_TYPES = Set.of(
            "service", "worker", "serverless", "cronJob", "autoScalingGroup", "containerOrchestrator");
    private static final Set<String> MANAGED_DATABASE_TYPES = Set.of(
            "database", "dataWarehouse", "searchIndex", "dataLake");

    private final CostModel costModel;
    private final AzurePricingClient pricingClient;

    public PricingController(CostModel costModel, AzurePricingClient pricingClient) {
        this.costModel = costModel;
        this.pricingClient = pricingClient;
    }

    @PostMapping("/estimate")
    public PricingEstimateResponse estimate(@RequestBody PricingEstimateRequest request) {
        List<PricingEstimateResponse.NodeCost> nodeCosts = request.graphJson().nodes().stream()
                .map(this::costOf)
                .toList();
        double total = nodeCosts.stream().mapToDouble(PricingEstimateResponse.NodeCost::monthlyCostUsd).sum();
        return new PricingEstimateResponse(total, "azure", "eastus", nodeCosts);
    }

    /** Below this, SMALL; below MEDIUM_MAX, MEDIUM; otherwise LARGE. Thresholds are deliberately rough — this is a tier pick, not a sizing calculator. */
    private AzurePricingClient.Tier tierFor(double configuredSize, double mediumMax, double largeMax) {
        if (configuredSize <= mediumMax) return AzurePricingClient.Tier.SMALL;
        if (configuredSize <= largeMax) return AzurePricingClient.Tier.MEDIUM;
        return AzurePricingClient.Tier.LARGE;
    }

    private static final Map<AzurePricingClient.Tier, String> COMPUTE_SKU_LABEL = Map.of(
            AzurePricingClient.Tier.SMALL, "Standard_B2s",
            AzurePricingClient.Tier.MEDIUM, "Standard_D2s_v3",
            AzurePricingClient.Tier.LARGE, "Standard_D4s_v3");
    private static final Map<AzurePricingClient.Tier, String> DATABASE_SKU_LABEL = Map.of(
            AzurePricingClient.Tier.SMALL, "Burstable B1ms",
            AzurePricingClient.Tier.MEDIUM, "Burstable B2ms",
            AzurePricingClient.Tier.LARGE, "Burstable B4ms");
    private static final Map<AzurePricingClient.Tier, String> CACHE_SKU_LABEL = Map.of(
            AzurePricingClient.Tier.SMALL, "Basic C0",
            AzurePricingClient.Tier.MEDIUM, "Basic C1",
            AzurePricingClient.Tier.LARGE, "Basic C2");

    private PricingEstimateResponse.NodeCost costOf(PricingEstimateRequest.NodeJson n) {
        GraphNode node = new GraphNode(n.id(), n.type(), n.config());
        int units = costModel.unitsOf(node);

        if (GENERIC_COMPUTE_TYPES.contains(n.type())) {
            // maxConcurrency (service/worker/serverless) or maxThroughput (queue/cronJob/autoScalingGroup) — whichever the type actually configures.
            double configuredSize = Math.max(node.getNumber("maxConcurrency", 0), node.getNumber("maxThroughput", 0));
            var tier = tierFor(configuredSize, 800, 3000);
            var real = pricingClient.monthlyPriceUsd(AzurePricingClient.computeCategoryFor(tier));
            if (real.isPresent()) {
                return new PricingEstimateResponse.NodeCost(n.id(), n.type(), real.get() * units, "real",
                        "Azure " + COMPUTE_SKU_LABEL.get(tier) + " Linux VM as a stand-in for generic compute (sized from configured concurrency/throughput)");
            }
        } else if (MANAGED_DATABASE_TYPES.contains(n.type())) {
            double configuredSize = node.getNumber("maxConnections", 0);
            var tier = tierFor(configuredSize, 100, 500);
            var real = pricingClient.monthlyPriceUsd(AzurePricingClient.databaseCategoryFor(tier));
            if (real.isPresent()) {
                return new PricingEstimateResponse.NodeCost(n.id(), n.type(), real.get() * units, "real",
                        "Azure Database for PostgreSQL Flexible Server (" + DATABASE_SKU_LABEL.get(tier) + ") as a stand-in for managed data stores (sized from configured max connections)");
            }
        } else if ("cache".equals(n.type())) {
            double configuredSize = node.getNumber("maxThroughput", node.getNumber("maxConnections", 0));
            var tier = tierFor(configuredSize, 1000, 5000);
            var real = pricingClient.monthlyPriceUsd(AzurePricingClient.cacheCategoryFor(tier));
            if (real.isPresent()) {
                return new PricingEstimateResponse.NodeCost(n.id(), n.type(), real.get() * units, "real",
                        "Azure Cache for Redis, " + CACHE_SKU_LABEL.get(tier) + " (sized from configured throughput)");
            }
        } else if ("objectStorage".equals(n.type())) {
            var real = pricingClient.monthlyStorageCostUsd(ASSUMED_STORAGE_GB);
            if (real.isPresent()) {
                return new PricingEstimateResponse.NodeCost(n.id(), n.type(), real.get() * units, "real",
                        "Azure Blob Storage, Hot LRS, assuming " + (int) ASSUMED_STORAGE_GB + "GB stored");
            }
        }

        return new PricingEstimateResponse.NodeCost(n.id(), n.type(), costModel.monthlyCostOf(node), "illustrative",
                "No verified real-pricing mapping for this component type");
    }
}

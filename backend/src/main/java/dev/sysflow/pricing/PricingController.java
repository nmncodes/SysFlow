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

    private PricingEstimateResponse.NodeCost costOf(PricingEstimateRequest.NodeJson n) {
        GraphNode node = new GraphNode(n.id(), n.type(), n.config());
        int units = costModel.unitsOf(node);

        if (GENERIC_COMPUTE_TYPES.contains(n.type())) {
            var real = pricingClient.monthlyPriceUsd(AzurePricingClient.PricingCategory.GENERIC_COMPUTE);
            if (real.isPresent()) {
                return new PricingEstimateResponse.NodeCost(n.id(), n.type(), real.get() * units, "real",
                        "Azure Standard_B2s Linux VM as a stand-in for generic compute");
            }
        } else if (MANAGED_DATABASE_TYPES.contains(n.type())) {
            var real = pricingClient.monthlyPriceUsd(AzurePricingClient.PricingCategory.MANAGED_DATABASE);
            if (real.isPresent()) {
                return new PricingEstimateResponse.NodeCost(n.id(), n.type(), real.get() * units, "real",
                        "Azure Database for PostgreSQL Flexible Server (Burstable B1ms) as a stand-in for managed data stores");
            }
        } else if ("cache".equals(n.type())) {
            var real = pricingClient.monthlyPriceUsd(AzurePricingClient.PricingCategory.CACHE);
            if (real.isPresent()) {
                return new PricingEstimateResponse.NodeCost(n.id(), n.type(), real.get() * units, "real",
                        "Azure Cache for Redis, Basic C0");
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

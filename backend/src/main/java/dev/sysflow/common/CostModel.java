package dev.sysflow.common;

import dev.sysflow.simulation.model.GraphNode;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;

/**
 * Rough, illustrative monthly USD cost per component instance — not real cloud pricing,
 * just enough to make cost trade-offs visible in AI findings. Mirrors
 * frontend/src/lib/cost.ts's MONTHLY_COST_USD; keep the two in sync manually.
 */
@Component
public class CostModel {

    private static final Set<String> REPLICATED_STORE_TYPES = Set.of("database", "searchIndex", "dataWarehouse");
    private static final Set<String> SCALING_GROUP_TYPES = Set.of("autoScalingGroup", "containerOrchestrator");

    /** How many billable units (replicas/instances) a node represents — shared with real-pricing lookups. */
    public int unitsOf(GraphNode node) {
        if (SCALING_GROUP_TYPES.contains(node.type())) {
            return (int) Math.max(1, node.getNumber("minReplicas", 1));
        }
        if (REPLICATED_STORE_TYPES.contains(node.type())) {
            return 1 + (int) Math.max(0, node.getNumber("replicaCount", 0));
        }
        return 1;
    }

    private static final Map<String, Double> MONTHLY_COST_USD = Map.ofEntries(
            Map.entry("client", 0.0), Map.entry("mobile", 0.0), Map.entry("webBrowser", 0.0), Map.entry("iotDevice", 0.0),
            Map.entry("dns", 1.0), Map.entry("cdn", 20.0), Map.entry("loadBalancer", 18.0), Map.entry("apiGateway", 15.0),
            Map.entry("waf", 12.0), Map.entry("ingress", 10.0),
            Map.entry("service", 25.0), Map.entry("worker", 20.0), Map.entry("serverless", 5.0), Map.entry("queue", 10.0),
            Map.entry("autoScalingGroup", 25.0), Map.entry("containerOrchestrator", 70.0), Map.entry("cronJob", 5.0),
            Map.entry("cache", 15.0), Map.entry("database", 60.0), Map.entry("dataWarehouse", 220.0),
            Map.entry("objectStorage", 15.0), Map.entry("searchIndex", 45.0), Map.entry("dataLake", 180.0),
            Map.entry("messageBroker", 30.0), Map.entry("eventBus", 20.0), Map.entry("webhook", 5.0),
            Map.entry("monitoring", 25.0), Map.entry("logging", 25.0),
            Map.entry("thirdPartyApi", 0.0), Map.entry("paymentGateway", 0.0)
    );

    /** Monthly cost for one node, accounting for replica/scaling config the same way the frontend badge does. */
    public double monthlyCostOf(GraphNode node) {
        return MONTHLY_COST_USD.getOrDefault(node.type(), 10.0) * unitsOf(node);
    }
}

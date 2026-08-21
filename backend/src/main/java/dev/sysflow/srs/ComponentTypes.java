package dev.sysflow.srs;

import java.util.Set;

/** Mirrors frontend/src/components/nodes.ts ComponentType — kept in sync manually. */
public final class ComponentTypes {

    public static final Set<String> VALID_TYPES = Set.of(
            "client", "mobile", "webBrowser", "iotDevice",
            "dns", "cdn", "loadBalancer", "apiGateway", "waf", "ingress",
            "service", "worker", "serverless", "queue", "autoScalingGroup", "containerOrchestrator", "cronJob",
            "cache", "database", "dataWarehouse", "objectStorage", "searchIndex", "dataLake",
            "messageBroker", "eventBus", "webhook",
            "monitoring", "logging",
            "thirdPartyApi", "paymentGateway"
    );

    public static final String FALLBACK_TYPE = "service";

    private ComponentTypes() {
    }
}

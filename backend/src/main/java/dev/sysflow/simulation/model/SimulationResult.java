package dev.sysflow.simulation.model;

import java.util.List;

public record SimulationResult(List<Tick> ticks, SimulationSummary summary) {
}

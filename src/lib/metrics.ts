/**
 * Deterministic stand-in telemetry for the container fleet.
 *
 * The agent does not collect resource metrics — `agent/docker_tools.py` reads
 * logs, env and container state only — so CPU/memory shown in the dashboard are
 * generated here rather than measured. They are derived from the container id
 * and the wall clock, which gives two properties the previous `Math.random()`
 * call lacked: concurrent requests agree on a value, and successive samples
 * drift smoothly instead of jumping the full range on every render.
 *
 * Replacing this with real telemetry means adding cpu/memory columns to
 * `statuses` and reporting them from the agent's heartbeat; call sites only
 * ever see {@link ContainerMetrics}, so nothing else has to change.
 */

/** CPU re-rolls fast — it is the spiky signal. */
const CPU_PERIOD_MS = 10_000;

/** Memory drifts an order of magnitude slower, the way a real heap does. */
const MEMORY_PERIOD_MS = 90_000;

/** Offsets the memory noise field so it never correlates with the CPU one. */
const MEMORY_SEED_OFFSET = 977;

export type ContainerMetrics = {
  /** Percentage, 0–100, one decimal place. */
  cpu: number;
  /** Percentage, 0–100, one decimal place. */
  memory: number;
};

const clampPercent = (value: number): number =>
  Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;

/** 32-bit integer hash mapped onto [0, 1) — mulberry32's finalizer. */
function hashUnit(n: number): number {
  let h = Math.imul(n ^ (n >>> 15), n | 1);
  h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
  return ((h ^ (h >>> 14)) >>> 0) / 4_294_967_296;
}

/**
 * Value noise in [0, 1): hashes at integer ticks and smoothstep-interpolates
 * between them, so neighbouring ticks stay close instead of being independent
 * draws. This is what makes the readouts drift rather than flicker.
 */
function smoothNoise(seed: number, tick: number): number {
  const whole = Math.floor(tick);
  const frac = tick - whole;
  const from = hashUnit(seed + whole * 0x9e37);
  const to = hashUnit(seed + (whole + 1) * 0x9e37);
  return from + (to - from) * frac * frac * (3 - 2 * frac);
}

/**
 * Each container gets a stable personality from its id, so one service sits
 * busy while another idles — a flat fleet reads as obviously synthetic.
 */
function profile(containerId: number) {
  const a = hashUnit(containerId * 0x1f123bb5);
  const b = hashUnit(containerId * 0x27d4eb2d);
  return {
    cpuBase: 12 + a * 62,
    cpuSwing: 6 + b * 18,
    memoryBase: 24 + b * 52,
    memorySwing: 3 + a * 9,
  };
}

/**
 * Resource usage for a container at a point in time. Stable for any given
 * (containerId, 10s window) pair, so a refresh returns what the last caller saw.
 */
export function containerMetrics(
  containerId: number,
  at: number = Date.now(),
): ContainerMetrics {
  const { cpuBase, cpuSwing, memoryBase, memorySwing } = profile(containerId);

  const cpuWave = smoothNoise(containerId, at / CPU_PERIOD_MS) - 0.5;
  const memoryWave =
    smoothNoise(containerId + MEMORY_SEED_OFFSET, at / MEMORY_PERIOD_MS) - 0.5;

  return {
    cpu: clampPercent(cpuBase + cpuWave * 2 * cpuSwing),
    memory: clampPercent(memoryBase + memoryWave * 2 * memorySwing),
  };
}

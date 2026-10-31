// Degrees and seconds. The middle of each pass keeps the original 5 deg/s.
export const MOTION = Object.freeze({ limit: 15, speed: 5, easeBand: 4 });
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const smoothstep = t => { const x=clamp(t,0,1);return x*x*(3-2*x); };
export const wrapDegrees = angle => ((angle+180)%360+360)%360-180;

const acceleration = MOTION.speed ** 2 / (2 * MOTION.easeBand);
const edgeTime = 2 * MOTION.easeBand / MOTION.speed;
const middleTime = (2 * MOTION.limit - 2 * MOTION.easeBand) / MOTION.speed;
export const HALF_PERIOD = 2 * edgeTime + middleTime;
export const PERIOD = 2 * HALF_PERIOD;

export function motionAt(phase) {
  const cycle = ((phase % PERIOD) + PERIOD) % PERIOD;
  const backwards = cycle >= HALF_PERIOD;
  const t = backwards ? cycle - HALF_PERIOD : cycle;
  let distance, velocity;
  if (t < edgeTime) {
    distance = .5 * acceleration * t * t;
    velocity = acceleration * t;
  } else if (t <= edgeTime + middleTime) {
    distance = MOTION.easeBand + MOTION.speed * (t - edgeTime);
    velocity = MOTION.speed;
  } else {
    const remaining = HALF_PERIOD - t;
    distance = 2 * MOTION.limit - .5 * acceleration * remaining * remaining;
    velocity = acceleration * remaining;
  }
  return { angle: backwards ? MOTION.limit - distance : -MOTION.limit + distance, velocity: backwards ? -velocity : velocity };
}

export function phaseForAngle(angle, direction=1) {
  const bounded = clamp(angle, -MOTION.limit, MOTION.limit);
  const distance = direction > 0 ? bounded + MOTION.limit : MOTION.limit - bounded;
  let t;
  if (distance < MOTION.easeBand) t=Math.sqrt(2*distance/acceleration);
  else if (distance > 2*MOTION.limit-MOTION.easeBand) t=HALF_PERIOD-Math.sqrt(2*(2*MOTION.limit-distance)/acceleration);
  else t=edgeTime+(distance-MOTION.easeBand)/MOTION.speed;
  return (direction>0 ? t : HALF_PERIOD+t) % PERIOD;
}

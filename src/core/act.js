// Act timestamps are simulation seconds. Hit freezes are authored into the FX;
// the inspector labels them rather than changing simulation time a second time.
export function actTimeline(fx) {
  const act = fx.act ?? fx.meta.act;
  if (!act) return { startTime: 0, endTime: fx.meta.duration };
  const windup = act.windup ?? 0;
  const recovery = act.recovery ?? 0;
  if (![windup, recovery].every(value => Number.isFinite(value) && value >= 0)) {
    throw new Error('act.windup and act.recovery must be nonnegative seconds');
  }
  const events = [fx.meta.duration];
  for (const pose of act.poses ?? []) {
    if (!Array.isArray(pose) || !Number.isFinite(pose[0])) throw new Error('Invalid act pose timestamp');
    events.push(pose[0]);
  }
  for (const hit of act.hits ?? []) {
    if (!Number.isFinite(hit.t) || !Number.isFinite(hit.freeze ?? 0) || (hit.freeze ?? 0) < 0) throw new Error('Invalid act hit');
    events.push(hit.t + (hit.freeze ?? 0));
  }
  return { startTime: -windup, endTime: Math.max(...events) + recovery };
}

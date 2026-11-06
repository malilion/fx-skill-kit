// Copy to fx.config.js to register domain checks. No config means CHK-06 skips.
export const domainChecks = [
  {
    id: 'example/no-op',
    run(ctx) {
      return { pass: true, detail: `${ctx.meta.id}: ${ctx.frames.length} sampled frames, seed=${ctx.seed}` };
    },
  },
  {
    id: 'inkfx/entropy',
    run() { return { pass: true, skip: true, detail: 'Stub: implement ink-tone entropy for inkfx' }; },
  },
  {
    id: 'oledfx/shimmer',
    run() { return { pass: true, skip: true, detail: 'Stub: implement isolated-pixel shimmer for oledfx' }; },
  },
];

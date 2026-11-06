# Primitives quick reference

All FX drawing helpers use straight-alpha RGBA byte colors and a row-major `Uint8ClampedArray`. Import from `src/core/frame.js`, relative to the FX module.

| Helper | Use |
| --- | --- |
| `createFrame(w,h,ox=w/2,oy=h/2)` | Allocate transparent RGBA storage. Tools supply this to FX draw calls. |
| `clear(frame)` | Zero every channel. The runner does this before each draw. |
| `setPixel(frame,x,y,[r,g,b,a=255])` | Floor coordinates, clip safely, and composite source over destination. |
| `fillCircle(frame,cx,cy,radius,color,softness=0)` | Draw pixel-center coverage; softness 0..1 controls edge feathering. |
| `mulberry32(seed)` from `src/core/seed.js` | Return a deterministic PRNG; initialize once in `create`. |

Use `frame.ox`/`frame.oy` as the effect origin. Generate random particle parameters in `create({seed})`; advance state only in `step(dt)`; render a complete frame in `draw(frame)`. Keep transparent pixels' RGB zero. Avoid `Math.random`, `Date.now`, and `performance.now`.

A non-loop envelope can use `Math.sin(Math.PI * Math.min(1,t/duration))`; a loop can use `150 + 80*Math.sin(2*Math.PI*t/duration)` for alpha. Handle negative t explicitly when authoring windup. See [AUTHORING.md](../../../docs/AUTHORING.md) for the full lifecycle and checks.

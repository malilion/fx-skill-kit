# Primitives quick reference

All FX drawing helpers use straight-alpha RGBA byte colors (`Uint8ClampedArray`) or project-specific dual-buffer (`InkFrame`) / 1-bit (`OledScreen`) adapters that composite into `frame`.

## Core RGBA & Seed (`src/core/frame.js`, `src/core/seed.js`)

| Helper | Use |
| --- | --- |
| `createFrame(w,h,ox=w/2,oy=h/2)` | Allocate transparent RGBA storage. Tools supply this to FX draw calls. |
| `clear(frame)` | Zero every channel. The runner does this before each draw. |
| `setPixel(frame,x,y,[r,g,b,a=255])` | Floor coordinates, clip safely, and composite source over destination. |
| `fillCircle(frame,cx,cy,radius,color,softness=0)` | Draw pixel-center coverage; softness 0..1 controls edge feathering. |
| `mulberry32(seed)` | Return a deterministic PRNG; initialize once in `create`. |
| `hash2d(x,y,seed=0)` | Deterministic 2D hash in `[0,1)` for dry-brush fibers and grain. |
| `paperGrainMap(w,h,seed=1,scale=5)` | Pre-generate a Xuan-paper fiber heightmap. |

## InkFX Dual-Buffer (`src/core/ink.js`, `src/core/palette.js`)

| Helper | Use |
| --- | --- |
| `createInkFrame(w,h,ox,oy,{seed})` | Allocate `pigment`, `wetness`, `tint`, and `paperGrain` buffers. |
| `stampDryBrush(ink,cx,cy,r,dryness,intensity,tintIdx)` | Deposit pigment & wetness with paper-fiber dry-brush (`feibai`) gaps. |
| `stampInkStroke(ink,x0,y0,x1,y1,r,dryness,intensity,tintIdx)` | Draw a calligraphic stroke between two local points. |
| `stampInkDrop(ink,cx,cy,r,alpha,tintIdx)` | Stamp a wet ink droplet (`tintIdx`: 0=ink, 1=cinnabar/accent, 2=gold). |
| `stepInkDiffusion(ink,dt,opts)` | Diffuse wet ink to 4-neighbors and deposit dark water-stain fringe (`水痕`). |
| `compositeInkFrame(ink,frame,{palette,paperBackground})` | Map 6-stage mineral ramps (`songyan`, `zhusha`, `shiqing`, `nijin`) to RGBA. |

## OLEDFX 1-bit & Dithering (`src/core/oled.js`, `src/core/dither.js`)

| Helper | Use |
| --- | --- |
| `createOledScreen(w=128,h=64,{dither})` | Allocate a 1-bit screen with `fillRoundRect`, `fillCircle`, `strokeRect`, `line`, `arc`, and `toFrame(frame,{dualZone})`. |
| `ditherSample(x,y,luma,mode)` | Convert `[0,1]` luma using `threshold`, `bayer4x4` (17-step ordered), or `checker`. |
| `ditherBuffer(gray,w,h,mode)` | Convert a full grayscale buffer using `bayer4x4`, `threshold`, `checker`, or `atkinson`. |

Use `frame.ox`/`frame.oy` as the effect origin. Generate random particle parameters in `create({seed})`; advance state only in `step(dt)`; render a complete frame in `draw(frame)`. Avoid `Math.random`, `Date.now`, and `performance.now`. See [AUTHORING.md](../../../docs/AUTHORING.md) for the full lifecycle and checks.

// FX may accept a named palette or a list of #RRGGBB colors in create(opts).
export const palettes = {
  ink: ['#1e2a2e', '#2a4046'],
  songyan: ['#161412', '#b82921'],
  zhusha: ['#8a2424', '#c83228'],
  shiqing: ['#2c6e7f', '#649a91'],
  gold: ['#997b27', '#d4af37'],
  nijin: ['#15130f', '#d4af37'],
};

// 6-stage traditional mineral color ramps: [paper/清, 淡, 重, 濃, 焦, accent/點綴色]
export const mineralRamps = {
  songyan: ['#f4efe6', '#c9c2b8', '#7d766d', '#3b3734', '#161412', '#b82921'],
  ink: ['#f4efe6', '#c9c2b8', '#7d766d', '#3b3734', '#161412', '#b82921'],
  zhusha: ['#f4efe6', '#dfb8b0', '#a85249', '#63201b', '#1c1211', '#c83228'],
  shiqing: ['#f4efe6', '#b8d0d2', '#649a91', '#2c6e7f', '#122a32', '#2c6e7f'],
  nijin: ['#f4efe6', '#d8cba8', '#997b27', '#423618', '#15130f', '#d4af37'],
  gold: ['#f4efe6', '#d8cba8', '#997b27', '#423618', '#15130f', '#d4af37'],
};

export function paletteColors(input, fallback = palettes.ink) {
  const colors = input === undefined ? fallback : typeof input === 'string' ? palettes[input] : input;
  if (!Array.isArray(colors) || !colors.length || colors.some(c => !/^#[0-9a-f]{6}$/i.test(c))) {
    throw new Error(`Palette must be ${Object.keys(palettes).join(', ')} or an array of #RRGGBB colors`);
  }
  return colors.map(c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)));
}

export function mineralRampColors(input, fallback = mineralRamps.songyan) {
  if (input === undefined || input === '') return paletteColors(fallback);
  if (typeof input === 'string') {
    const ramp = mineralRamps[input];
    if (!ramp) throw new Error(`Palette must be ${Object.keys(mineralRamps).join(', ')} or an array of #RRGGBB colors`);
    return paletteColors(ramp);
  }
  const parsed = paletteColors(input);
  if (parsed.length >= 6) return parsed.slice(0, 6);
  const base = paletteColors(fallback);
  if (parsed.length === 1) {
    base[4] = parsed[0];
    base[5] = parsed[0];
  } else {
    base[4] = parsed[0];
    base[5] = parsed[1];
  }
  return base;
}


// FX may accept a named palette or a list of #RRGGBB colors in create(opts).
export const palettes = {
  ink: ['#1e2a2e', '#2a4046'],
  zhusha: ['#8a2424', '#c83228'],
  shiqing: ['#2c6e7f', '#649a91'],
  gold: ['#997b27', '#d4af37'],
};
export function paletteColors(input, fallback = palettes.ink) {
  const colors = input === undefined ? fallback : typeof input === 'string' ? palettes[input] : input;
  if (!Array.isArray(colors) || !colors.length || colors.some(c => !/^#[0-9a-f]{6}$/i.test(c))) {
    throw new Error(`Palette must be ${Object.keys(palettes).join(', ')} or an array of #RRGGBB colors`);
  }
  return colors.map(c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)));
}

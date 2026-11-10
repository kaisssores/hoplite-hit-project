// Contrast check for the Haze palettes. Run with: node scripts/contrast.mjs
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255]
    .map((c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
};
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return ((x + 0.05) / (y + 0.05)).toFixed(2);
};

const themes = {
  haze: { deep: "#EEF2F8", page: "#F7F9FC", card: "#FFFFFF", raised: "#EAEFF6", text: "#111B2E", text2: "#44516A", text3: "#5B6780", accent: "#B7D1F3", ink: "#0D2647", atext: "#285CA6", aline: "#5A8ED6", pos: "#1B7A50", warn: "#93600A", neg: "#BF3339" },
  night: { deep: "#0A101C", page: "#0E1524", card: "#131B2D", raised: "#1A2438", text: "#E7EDF7", text2: "#A6B2C6", text3: "#8693AA", accent: "#A9C8F4", ink: "#0A1C36", atext: "#A9C8F4", aline: "#8DB5EE", pos: "#5CC99A", warn: "#E3B35A", neg: "#F07A7E" },
};

for (const [name, t] of Object.entries(themes)) {
  const rows = [];
  for (const bg of ["page", "card", "raised", "deep"]) {
    for (const fg of ["text2", "text3", "atext", "pos", "warn", "neg"]) rows.push(`${fg}/${bg}=${ratio(t[fg], t[bg])}`);
  }
  rows.push(`ink/accent=${ratio(t.ink, t.accent)}`, `aline/card=${ratio(t.aline, t.card)}`, `aline/page=${ratio(t.aline, t.page)}`);
  console.log(name + "\n  " + rows.join("  "));
}

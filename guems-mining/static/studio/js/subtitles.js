// Sous-titres : lecture des fichiers SRT (horodatage hh:mm:ss,mmm --> hh:mm:ss,mmm).

export function parseSrt(text) {
  const toS = (h, m, s, ms) => Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
  return text.replace(/\r/g, '').split(/\n{2,}/).map((block) => {
    const lines = block.trim().split('\n');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) return null;
    const m = /(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/.exec(lines[i]);
    if (!m) return null;
    const start = toS(m[1], m[2], m[3], m[4]); const end = toS(m[5], m[6], m[7], m[8]);
    const content = lines.slice(i + 1).join('\n').replace(/<[^>]+>/g, '').trim();
    return end > start && content ? { start, end, content } : null;
  }).filter(Boolean);
}


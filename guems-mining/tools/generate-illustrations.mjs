// Génère les illustrations vectorielles abstraites (noir et orange) utilisées
// tant qu'aucune photographie authentique ou sous licence n'est fournie.
// Usage : node tools/generate-illustrations.mjs
import { writeFileSync } from 'node:fs';

const out = new URL('../static/assets/img/illustrations/', import.meta.url);
import { mkdirSync } from 'node:fs';
mkdirSync(out, { recursive: true });

const f = (n) => n.toFixed(1);

// Courbes de niveau type carte topographique.
function contours({ w, h, lines, amp, seed, opacity }) {
  let paths = '';
  for (let i = 0; i < lines; i++) {
    const y0 = (h / lines) * i + h / lines / 2;
    let d = `M0 ${f(y0)}`;
    for (let x = 0; x <= w; x += 20) {
      const y = y0
        + Math.sin(x / 140 + i * 0.35 + seed) * amp
        + Math.sin(x / 57 + i * 0.9 + seed * 2) * amp * 0.35
        + Math.cos(x / 310 - i * 0.2) * amp * 1.4;
      d += ` L${x} ${f(y)}`;
    }
    const o = (opacity * (0.35 + 0.65 * Math.abs(Math.sin(i * 0.6 + seed)))).toFixed(3);
    paths += `<path d="${d}" stroke="#F96A00" stroke-opacity="${o}" stroke-width="${i % 5 === 0 ? 1.6 : 0.8}" fill="none"/>`;
  }
  return paths;
}

function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">${body}</svg>\n`;
}

// 1. Bannière : terrain topographique + reliefs.
writeFileSync(new URL('terrain.svg', out), svg(1600, 900, `
<defs>
 <radialGradient id="g" cx="70%" cy="35%" r="80%"><stop offset="0" stop-color="#2b1608"/><stop offset=".45" stop-color="#151410"/><stop offset="1" stop-color="#0b0b0b"/></radialGradient>
 <linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#292929"/><stop offset="1" stop-color="#101010"/></linearGradient>
 <linearGradient id="accent" x1="0" x2="1"><stop offset="0" stop-color="#F96A00" stop-opacity="0"/><stop offset=".5" stop-color="#FF9A2E"/><stop offset="1" stop-color="#F96A00" stop-opacity="0"/></linearGradient>
</defs>
<rect width="1600" height="900" fill="url(#g)"/>
${contours({ w: 1600, h: 900, lines: 34, amp: 26, seed: 1.3, opacity: 0.22 })}
<path d="M0 760 L220 610 L360 680 L560 500 L720 640 L900 560 L1080 420 L1260 590 L1420 520 L1600 600 V900 H0Z" fill="url(#m)" opacity=".92"/>
<path d="M560 500 L720 640 L900 560 L1080 420" stroke="url(#accent)" stroke-width="2.5" fill="none"/>
<path d="M0 820 L300 720 L620 790 L980 690 L1300 760 L1600 700 V900 H0Z" fill="#0d0d0d"/>`));

// 2. Strates géologiques (extraction).
let strata = '';
const tones = ['#1a1a1a', '#231a14', '#2d1f12', '#1d1c1a', '#3a2410', '#141414', '#292929', '#1c1510'];
for (let i = 0; i < 8; i++) {
  const y = 80 + i * 90;
  let d = `M0 ${y}`;
  for (let x = 0; x <= 1200; x += 40) d += ` L${x} ${f(y + Math.sin(x / 160 + i) * 18 + Math.cos(x / 70 + i * 2) * 6)}`;
  d += ' V800 H0Z';
  strata += `<path d="${d}" fill="${tones[i]}"/>`;
  if (i % 2 === 1) {
    for (let k = 0; k < 14; k++) {
      const cx = (k * 97 + i * 53) % 1200, cy = y + 30 + ((k * 31) % 40);
      strata += `<circle cx="${cx}" cy="${cy}" r="${1.5 + (k % 3)}" fill="#F96A00" opacity="${(0.25 + (k % 4) * 0.15).toFixed(2)}"/>`;
    }
  }
}
writeFileSync(new URL('strates.svg', out), svg(1200, 800, `<rect width="1200" height="800" fill="#101010"/>${strata}
<path d="M0 260 C300 230 500 300 760 250 S1100 230 1200 250" stroke="#F96A00" stroke-width="2" fill="none" opacity=".7"/>`));

// 3. Gradins d'exploitation à ciel ouvert (vue stylisée).
let pit = '<rect width="1200" height="800" fill="#101010"/>';
for (let i = 0; i < 9; i++) {
  const rx = 620 - i * 62, ry = 330 - i * 33;
  pit += `<ellipse cx="600" cy="430" rx="${rx}" ry="${ry}" fill="${i % 2 ? '#1b1a17' : '#251c14'}" stroke="#F96A00" stroke-opacity="${(0.15 + i * 0.07).toFixed(2)}" stroke-width="${i === 8 ? 2 : 1}"/>`;
}
pit += '<ellipse cx="600" cy="430" rx="60" ry="30" fill="#0b0b0b"/>';
pit += '<path d="M600 430 C700 360 860 300 1100 120" stroke="#FF9A2E" stroke-width="2" stroke-dasharray="6 10" fill="none" opacity=".6"/>';
writeFileSync(new URL('gradins.svg', out), svg(1200, 800, pit));

// 4. Motif clair pour sections sur fond gris.
writeFileSync(new URL('motif-clair.svg', out), svg(1600, 600, `<rect width="1600" height="600" fill="#F4F4F4"/>${contours({ w: 1600, h: 600, lines: 18, amp: 18, seed: 4.2, opacity: 0.35 })}`));

console.log('Illustrations générées.');

// 5. Pelleteuse (trait orange) — visuel de bannière, en attendant des photographies réelles.
const exc = `
<defs>
 <linearGradient id="gb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9A2E"/><stop offset="1" stop-color="#E04E00"/></linearGradient>
 <radialGradient id="glow" cx="50%" cy="60%" r="50%"><stop offset="0" stop-color="#F96A00" stop-opacity=".22"/><stop offset="1" stop-color="#F96A00" stop-opacity="0"/></radialGradient>
</defs>
<ellipse cx="430" cy="430" rx="400" ry="240" fill="url(#glow)"/>
<g fill="none" stroke="url(#gb)" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
 <!-- chenilles -->
 <rect x="250" y="470" width="420" height="80" rx="40"/>
 <circle cx="292" cy="510" r="26"/><circle cx="628" cy="510" r="26"/>
 <circle cx="375" cy="522" r="14"/><circle cx="460" cy="522" r="14"/><circle cx="545" cy="522" r="14"/>
 <!-- tourelle -->
 <path d="M290 470 L300 400 L660 400 L680 470 Z"/>
 <path d="M560 400 L560 290 Q560 270 580 270 L650 270 Q668 270 672 288 L690 400"/>
 <path d="M585 300 L645 300 L655 370 L585 370 Z" stroke-width="4"/>
 <path d="M300 430 L660 430" stroke-width="3" opacity=".6"/>
 <!-- flèche et balancier -->
 <path d="M520 400 L470 250 Q460 215 425 205 L230 160"/>
 <path d="M500 395 L455 265 Q445 240 420 232 L240 190"/>
 <path d="M230 160 L240 190"/>
 <path d="M235 175 L170 330"/>
 <path d="M258 182 L195 335"/>
 <!-- vérins -->
 <path d="M540 330 L470 235" stroke-width="10" opacity=".85"/>
 <path d="M410 215 L255 150" stroke-width="8" opacity=".85"/>
 <!-- godet -->
 <path d="M160 325 Q120 345 125 395 L150 420 L210 380 L205 335 Z"/>
 <path d="M150 420 L140 440 M170 407 L162 430 M190 394 L184 418" stroke-width="5"/>
</g>
<!-- sol -->
<path d="M40 560 L820 560" stroke="#F96A00" stroke-width="3" opacity=".5"/>
<path d="M40 575 L760 575" stroke="#F96A00" stroke-width="1.5" opacity=".3"/>`;
writeFileSync(new URL('pelleteuse.svg', out), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 620">${exc}</svg>\n`);

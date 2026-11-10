import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "assets", "header.svg");

const scenes = {
  sunrise: {
    name: "aube",
    sky: ["#243B67", "#E07A3D", "#F6C48A"],
    glow: "#FFB703",
    core: "#FFE08A",
    hill: "#1D3557",
    hillBack: "#14213D",
    cloud: "#FFE8CC",
    cloudOpacity: 0.8,
    stars: 0.35,
    rays: true,
  },
  day: {
    name: "journée",
    sky: ["#1A73C7", "#79C6F8", "#E8F6FF"],
    glow: "#FFE566",
    core: "#FFF4B8",
    hill: "#1B4332",
    hillBack: "#16324F",
    cloud: "#FFFFFF",
    cloudOpacity: 0.92,
    stars: 0,
    rays: true,
  },
  sunset: {
    name: "soir",
    sky: ["#2B1055", "#C2410C", "#F6B73C"],
    glow: "#FF8C42",
    core: "#FFD29D",
    hill: "#1A1423",
    hillBack: "#120E18",
    cloud: "#FFD0A8",
    cloudOpacity: 0.75,
    stars: 0.2,
    rays: true,
  },
  night: {
    name: "nuit",
    sky: ["#070B1A", "#151B3A", "#24315C"],
    glow: "#D6E4FF",
    core: "#F7F3E8",
    hill: "#0B1320",
    hillBack: "#070B12",
    cloud: "#C5D0E6",
    cloudOpacity: 0.2,
    stars: 1,
    rays: false,
  },
};

function parisNow(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return { hour: Number(parts.hour), minute: Number(parts.minute) };
}

function sceneFor(hour) {
  if (hour >= 5 && hour < 8) return "sunrise";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "sunset";
  return "night";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function progress(hour, minute, scene) {
  const time = hour + minute / 60;
  if (scene === "night") {
    const since = time >= 21 ? time - 21 : time + 3;
    return clamp(since / 8, 0, 1);
  }
  return clamp((time - 5) / 16, 0, 1);
}

function mulberry32(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function cloud(x, y, scale) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <ellipse cx="0" cy="8" rx="36" ry="14"/>
    <ellipse cx="-22" cy="12" rx="18" ry="12"/>
    <ellipse cx="22" cy="12" rx="22" ry="12"/>
    <ellipse cx="6" cy="-2" rx="16" ry="14"/>
  </g>`;
}

function stars(opacity) {
  if (opacity <= 0) return "";
  const random = mulberry32(2026);
  const dots = [];
  for (let index = 0; index < 42; index += 1) {
    const x = (random() * 1200).toFixed(1);
    const y = (random() * 168).toFixed(1);
    const radius = (0.6 + random() * 1.5).toFixed(2);
    const duration = (1.8 + random() * 2.4).toFixed(1);
    dots.push(
      `<circle cx="${x}" cy="${y}" r="${radius}" fill="#F8FAFC">
        <animate attributeName="opacity" values="0.25;1;0.25" dur="${duration}s" repeatCount="indefinite"/>
      </circle>`,
    );
  }
  return `<g opacity="${opacity}">${dots.join("")}</g>`;
}

function rays(color) {
  const lines = [];
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const x1 = Math.cos(angle) * 38;
    const y1 = Math.sin(angle) * 38;
    const x2 = Math.cos(angle) * 56;
    const y2 = Math.sin(angle) * 56;
    lines.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`,
    );
  }
  return `<g opacity="0.8">
    <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="48s" repeatCount="indefinite"/>
    ${lines.join("")}
  </g>`;
}

function celestial(scene, palette, x, y) {
  const moon = scene === "night"
    ? `<circle cx="-7" cy="-4" r="5" fill="#E7E1D1"/>
       <circle cx="8" cy="6" r="3" fill="#E7E1D1"/>`
    : "";
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
    <animateTransform attributeName="transform" type="translate" values="${x.toFixed(1)} ${y.toFixed(1)}; ${x.toFixed(1)} ${(y - 6).toFixed(1)}; ${x.toFixed(1)} ${y.toFixed(1)}" dur="6s" repeatCount="indefinite"/>
    <circle r="72" fill="url(#glow)"/>
    ${palette.rays ? rays(palette.glow) : ""}
    <circle r="26" fill="${palette.core}"/>
    ${moon}
  </g>`;
}

function render(date = new Date()) {
  const { hour, minute } = parisNow(date);
  const scene = sceneFor(hour);
  const palette = scenes[scene];
  const amount = progress(hour, minute, scene);
  const x = 150 + amount * 900;
  const y = 176 - Math.sin(amount * Math.PI) * 108;
  const label = `Paris · ${palette.name} · ${String(hour).padStart(2, "0")} h`;
  const pill = Math.round(label.length * 8.6 + 36);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300" role="img" aria-labelledby="title desc">
  <title id="title">Ciel de Paris, ${palette.name}</title>
  <desc id="desc">En-tête animé. Le ciel, le soleil ou la lune suivent l'heure à Paris.</desc>
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.sky[0]}"/>
      <stop offset="58%" stop-color="${palette.sky[1]}"/>
      <stop offset="100%" stop-color="${palette.sky[2]}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${palette.glow}" stop-opacity="0.95"/>
      <stop offset="42%" stop-color="${palette.glow}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${palette.glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="300" fill="url(#sky)"/>
  ${stars(palette.stars)}
  ${celestial(scene, palette, x, y)}
  <g fill="${palette.cloud}" opacity="${palette.cloudOpacity}">
    <g>
      <animateTransform attributeName="transform" type="translate" from="-260 0" to="1280 0" dur="58s" repeatCount="indefinite"/>
      ${cloud(0, 58, 1)}
      ${cloud(320, 78, 0.8)}
      ${cloud(640, 48, 1.05)}
    </g>
    <g opacity="0.75">
      <animateTransform attributeName="transform" type="translate" from="1280 0" to="-260 0" dur="86s" repeatCount="indefinite"/>
      ${cloud(80, 96, 0.7)}
      ${cloud(460, 64, 0.9)}
    </g>
  </g>
  <path d="M0 228 C 180 186, 360 252, 560 210 C 760 170, 980 246, 1200 198 L 1200 300 L 0 300 Z" fill="${palette.hillBack}"/>
  <path d="M0 266 C 220 232, 430 292, 690 256 C 910 226, 1040 272, 1200 242 L 1200 300 L 0 300 Z" fill="${palette.hill}"/>
  <g transform="translate(1016 118)" fill="${palette.hillBack}">
    <path d="M34 140 L52 10 H60 L78 140 H66 L60 96 H52 L46 140 Z"/>
    <path d="M50 96 H62 L60 66 H52 Z"/>
    <rect x="52" y="0" width="8" height="12" rx="1"/>
    <rect x="40" y="66" width="32" height="4" rx="1"/>
  </g>
  <g transform="translate(48 242)">
    <rect width="${pill}" height="36" rx="18" fill="#0B1220" opacity="0.42"/>
    <text x="18" y="24" fill="#F8FAFC" font-family="ui-sans-serif, system-ui, sans-serif" font-size="16">${label}</text>
  </g>
</svg>
`;
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, render());
console.log(`Wrote ${out}`);

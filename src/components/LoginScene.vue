<template>
  <svg class="scene" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#071526" />
        <stop offset=".55" stop-color="#0d3b4f" />
        <stop offset=".8" stop-color="#1f6a6e" />
        <stop offset="1" stop-color="#e9a15a" />
      </linearGradient>
      <radialGradient id="sun" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="#ffd59a" stop-opacity=".9" />
        <stop offset=".35" stop-color="#f6b26b" stop-opacity=".35" />
        <stop offset="1" stop-color="#f6b26b" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="tank" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#eef3f7" />
        <stop offset=".45" stop-color="#c3cfda" />
        <stop offset="1" stop-color="#7d8fa1" />
      </linearGradient>
      <linearGradient id="cab" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2cc4a0" />
        <stop offset="1" stop-color="#0f7d68" />
      </linearGradient>
      <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0c1c2b" />
        <stop offset="1" stop-color="#050d16" />
      </linearGradient>
      <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
        <path d="M48 0H0V48" fill="none" stroke="#7fd8c4" stroke-width=".6" />
      </pattern>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>

    <rect width="1600" height="900" fill="url(#sky)" />
    <rect width="1600" height="668" fill="url(#grid)" opacity=".06" />
    <circle cx="1080" cy="640" r="260" fill="url(#sun)" />
    <g fill="#fff">
      <circle v-for="(s, i) in stars" :key="i" :cx="s[0]" :cy="s[1]" :r="s[2]" :opacity="s[3]" />
    </g>

    <!-- skyline -->
    <g fill="#1a4558" opacity=".55">
      <rect v-for="(b, i) in far" :key="'f' + i" :x="b[0]" :y="668 - b[1]" :width="b[2]" :height="b[1]" />
    </g>
    <g fill="#0b2233">
      <rect v-for="(b, i) in near" :key="'n' + i" :x="b[0]" :y="668 - b[1]" :width="b[2]" :height="b[1]" />
    </g>
    <g fill="#ffd38a">
      <rect v-for="(w, i) in windows" :key="'w' + i" :x="w[0]" :y="w[1]" width="3" height="4" :opacity="w[2]" />
    </g>

    <!-- treatment facility -->
    <g transform="translate(1330 560)" fill="#0b2233">
      <rect x="0" y="40" width="70" height="68" /><ellipse cx="35" cy="40" rx="35" ry="9" />
      <rect x="84" y="20" width="90" height="88" /><ellipse cx="129" cy="20" rx="45" ry="11" />
      <rect x="188" y="52" width="58" height="56" /><ellipse cx="217" cy="52" rx="29" ry="8" />
      <rect x="150" y="-40" width="10" height="70" />
      <path d="M0 108h260" stroke="#0b2233" stroke-width="2" />
      <circle cx="155" cy="-46" r="4" fill="#ff6b5b" class="blink" />
    </g>

    <!-- tracked route: device -> truck -> facility -->
    <path class="route" d="M120 640 C 380 300, 980 240, 1460 552" fill="none" stroke="#6fe3c6" stroke-width="2.5" stroke-dasharray="10 10" opacity=".85" />
    <g filter="url(#glow)" font-family="Inter, Segoe UI, sans-serif" font-size="13" fill="#d8fff4">
      <g transform="translate(212 512)"><circle r="7" fill="#f0a020" /><text x="14" y="4">Pump-out · DV538754</text></g>
      <g transform="translate(760 318)"><circle r="7" fill="#6fe3c6" /><text x="14" y="4">Transfer · 871 9M8 → 372 27M</text></g>
      <g transform="translate(1436 530)"><circle r="7" fill="#7cc4ff" /><text x="-170" y="-12">Unload · 7,450 L</text></g>
    </g>
    <g class="pulse" transform="translate(760 318)"><circle r="7" fill="none" stroke="#6fe3c6" stroke-width="2" /></g>

    <!-- ground and road -->
    <rect y="668" width="1600" height="232" fill="url(#ground)" />
    <path d="M0 742H1600" stroke="#f3c96b" stroke-width="3" stroke-dasharray="40 34" opacity=".35" />
    <path d="M0 668H1600" stroke="#2c5468" stroke-width="2" />

    <!-- grease trap + hose + tanker -->
    <g transform="translate(270 532) scale(1.35)">
      <ellipse cx="-118" cy="98" rx="38" ry="9" fill="#14293a" stroke="#4f7286" stroke-width="2" />
      <ellipse cx="-118" cy="96" rx="22" ry="4" fill="none" stroke="#4f7286" stroke-width="1" />
      <path d="M6 52 C -30 98, -70 64, -110 92" fill="none" stroke="#111d28" stroke-width="7" stroke-linecap="round" />
      <path d="M6 52 C -30 98, -70 64, -110 92" fill="none" stroke="#2d4a5e" stroke-width="2" stroke-linecap="round" />
      <rect x="0" y="62" width="425" height="13" rx="3" fill="#0a1522" />
      <rect x="18" y="-2" width="304" height="64" rx="32" fill="url(#tank)" />
      <path d="M90 0v62M170 -2v64M250 0v62" stroke="#8193a5" stroke-width="2" />
      <rect x="120" y="-10" width="70" height="9" rx="3" fill="#7d8fa1" />
      <text x="170" y="38" text-anchor="middle" font-family="Inter, Segoe UI, sans-serif" font-weight="800" font-size="17" fill="#0f4c5c" letter-spacing="1">{{ BRAND.name }}</text>
      <circle cx="6" cy="38" r="14" fill="#1b2a38" stroke="#7d8fa1" stroke-width="3" />
      <path d="M330 62V10h56l32 30v22z" fill="url(#cab)" />
      <path d="M344 18h38l24 24h-62z" fill="#a9dcf0" opacity=".85" />
      <rect x="412" y="48" width="12" height="6" rx="2" fill="#ffe6a3" />
      <g fill="#0a1522"><circle cx="76" cy="80" r="18" /><circle cx="122" cy="80" r="18" /><circle cx="380" cy="80" r="18" /></g>
      <g fill="#8a94a6"><circle cx="76" cy="80" r="7" /><circle cx="122" cy="80" r="7" /><circle cx="380" cy="80" r="7" /></g>
      <g transform="translate(278 18)" fill="#0f4c5c" opacity=".8">
        <rect width="22" height="22" rx="2" fill="#fff" />
        <rect x="3" y="3" width="6" height="6" /><rect x="13" y="3" width="6" height="6" /><rect x="3" y="13" width="6" height="6" />
        <rect x="13" y="13" width="3" height="3" /><rect x="16" y="16" width="3" height="3" />
      </g>
    </g>
  </svg>
</template>
<script setup>
import { BRAND } from '../brand'
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
}
const r = rng(42)
const stars = Array.from({ length: 70 }, () => [r() * 1600, r() * 380, r() * 1.3 + 0.3, r() * 0.6 + 0.2])
const far = [], near = [], windows = []
for (let x = 380; x < 1320; x += 18 + r() * 26) far.push([x, 90 + r() * 200, 22 + r() * 30])
for (let x = 420; x < 1300; x += 26 + r() * 30) {
  const h = 40 + r() * (x > 700 && x < 1000 ? 210 : 110), w = 24 + r() * 34
  near.push([x, h, w])
  for (let wy = 668 - h + 8; wy < 660; wy += 11) for (let wx = x + 5; wx < x + w - 5; wx += 8) if (r() < 0.16) windows.push([wx, wy, 0.35 + r() * 0.5])
}
</script>
<style scoped>
.scene { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.route { animation: flow 2.4s linear infinite; }
@keyframes flow { to { stroke-dashoffset: -40; } }
.pulse circle { transform-origin: center; animation: pulse 2s ease-out infinite; }
@keyframes pulse { from { transform: scale(1); opacity: .9; } to { transform: scale(3.2); opacity: 0; } }
.blink { animation: blink 1.6s steps(1) infinite; }
@keyframes blink { 50% { opacity: .15; } }
</style>

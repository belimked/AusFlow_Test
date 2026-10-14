<template>
  <svg :width="size" :height="size" viewBox="0 0 48 48" aria-label="logo" role="img">
    <defs>
      <linearGradient id="bl-drop" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3fb1e3" />
        <stop offset="1" stop-color="#0b5d8a" />
      </linearGradient>
    </defs>
    <path d="M24 3C24 3 8 21 8 31a16 16 0 0 0 32 0C40 21 24 3 24 3z" fill="url(#bl-drop)" />
    <path d="M10.5 35c5-3.6 9.5-3.6 13.5 0s8.5 3.6 13.5 0" fill="none" stroke="#2cc4a0" stroke-width="3" stroke-linecap="round" />
    <g fill="#fff">
      <path v-for="(s, i) in STARS" :key="i" :d="star(s[0], s[1], s[2])" />
    </g>
  </svg>
</template>
<script setup>
defineProps({ size: { type: Number, default: 32 } })
// Southern Cross
const STARS = [[24, 14.5, 2.6], [19, 22, 2.3], [29, 21, 2.3], [24, 29, 2.8], [26.8, 25.2, 1.3]]
function star(cx, cy, r) {
  const p = []
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r
    p.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`)
  }
  return 'M' + p.join('L') + 'Z'
}
</script>

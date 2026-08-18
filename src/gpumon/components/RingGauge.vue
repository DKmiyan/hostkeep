<script setup lang="ts">
// 圆环仪表：细轨道 + 语义色弧线，中心大数字
// kind='load'（利用率类：高档负载橙）/ 'cap'（容量类：高档告警红，默认）
import { utilColor, loadColor } from '../format'

const props = defineProps<{
  pct: number
  big: string
  unit?: string
  label: string
  cap?: string
  kind?: 'load' | 'cap'
}>()

const R = 46
const C = 2 * Math.PI * R
const arc = computed(() => (Math.max(0, Math.min(100, props.pct)) / 100) * C)
const color = computed(() =>
  props.pct > 0 ? (props.kind === 'load' ? loadColor(props.pct) : utilColor(props.pct)) : 'var(--gm-idle)'
)
</script>

<template>
  <div class="text-center">
    <svg width="116" height="116" viewBox="0 0 116 116" class="mx-auto block">
      <circle cx="58" cy="58" :r="R" fill="none" stroke="var(--gm-track)" stroke-width="8" />
      <!-- 25% 刻度点 -->
      <circle v-for="q in 4" :key="q" :cx="58 + R * Math.cos((q * Math.PI) / 2)" :cy="58 + R * Math.sin((q * Math.PI) / 2)" r="1.6" fill="var(--art-gray-400, #b0b3ba)" />
      <circle
        cx="58" cy="58" :r="R" fill="none"
        :stroke="color"
        stroke-width="8" stroke-linecap="round"
        :stroke-dasharray="`${arc} ${C}`"
        transform="rotate(-90 58 58)"
        :style="{ color: color, filter: 'drop-shadow(0 0 5px var(--gm-glow))', transition: 'stroke-dasharray 0.6s ease' }"
      />
      <text
        x="58" y="55" text-anchor="middle" fill="var(--art-gray-900, #303133)"
        style="font-family: var(--gm-mono); font-size: 19px; font-weight: 700"
      >
        {{ big }}<tspan v-if="unit" style="font-size: 11px; font-weight: 500">{{ unit }}</tspan>
      </text>
      <text x="58" y="74" text-anchor="middle" fill="var(--art-gray-600, #606266)" style="font-size: 12px">
        {{ label }}
      </text>
    </svg>
    <div v-if="cap" class="mt-2 text-xs text-g-500">{{ cap }}</div>
  </div>
</template>

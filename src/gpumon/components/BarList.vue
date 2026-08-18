<script setup lang="ts">
export interface BarRow {
  label: string
  pct: number
  value: string
  color: string
}
defineProps<{ rows: BarRow[]; empty?: string }>()
const emit = defineEmits<{ pick: [label: string] }>()
</script>

<template>
  <div v-if="rows.length" class="gm-rows">
    <div
      v-for="r in rows"
      :key="r.label"
      class="row clickable"
      role="link"
      tabindex="0"
      :title="r.label"
      @click="emit('pick', r.label)"
      @keydown.enter="emit('pick', r.label)"
    >
      <span class="nm">{{ r.label }}</span>
      <div class="gm-bar"><i :style="{ width: Math.min(100, r.pct) + '%', background: r.color, '--g': r.color }" /></div>
      <span class="val">{{ r.value }}</span>
    </div>
  </div>
  <div v-else class="text-xs text-g-500">{{ empty ?? '暂无数据' }}</div>
</template>

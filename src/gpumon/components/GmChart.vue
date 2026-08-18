<script setup lang="ts">
// 轻量 ECharts 容器：option 全由父组件计算（含明暗配色），本组件只管挂载/更新/resize
import { echarts } from '@/plugins/echarts'
import type { EChartsOption } from '@/plugins/echarts'

const props = defineProps<{ option: EChartsOption; height?: string }>()
const emit = defineEmits<{ select: [params: { name: string; value: unknown }] }>()

const el = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

function render() {
  if (!el.value) return
  if (!chart) {
    chart = echarts.init(el.value)
    chart.on('click', (p) => emit('select', { name: String(p.name ?? ''), value: p.value }))
  }
  chart.setOption(props.option, { notMerge: true })
}

const ro = new ResizeObserver(() => chart?.resize())

onMounted(() => {
  render()
  if (el.value) ro.observe(el.value)
})

watch(
  () => props.option,
  () => render(),
  { deep: true }
)

onBeforeUnmount(() => {
  ro.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="el" :style="{ height: height ?? '16rem', width: '100%' }" />
</template>

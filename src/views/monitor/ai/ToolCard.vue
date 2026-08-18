<!-- AI 工具结果卡片：按后端 ui.kind 渲染表格 / 图表 / kv / multi（递归） -->
<template>
  <template v-if="ui.kind === 'multi'">
    <ToolCard v-for="(c, i) in ui.cards" :key="i" :ui="c" class="mt-2" />
  </template>

  <div v-else class="tc">
    <div v-if="ui.title" class="tc-title">{{ ui.title }}</div>

    <GmChart v-if="ui.kind === 'chart' && ui.x?.length" :option="chartOpt" height="15rem" />

    <ElTable
      v-else-if="ui.kind === 'table'"
      :data="ui.rows ?? []"
      size="small"
      max-height="340"
      class="tc-table"
    >
      <ElTableColumn
        v-for="c in ui.columns"
        :key="c.key"
        :prop="c.key"
        :label="c.label"
        :min-width="colWidth(c.key)"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <span v-if="c.key === 'state'" :style="{ color: stateColor(String(row[c.key] ?? '')) }">
            {{ row[c.key] }}
          </span>
          <template v-else>{{ row[c.key] }}</template>
        </template>
      </ElTableColumn>
    </ElTable>

    <div v-else-if="ui.kind === 'kv'" class="tc-kv">
      <div v-for="(it, i) in ui.items" :key="i" class="row">
        <span class="k">{{ it.k }}</span>
        <span class="v gm-num">{{ it.v }}</span>
      </div>
    </div>

    <div v-if="ui.kind === 'table' && (ui.rows?.length ?? 0) > 8" class="tc-count">
      共 {{ ui.rows!.length }} 行
    </div>
  </div>
</template>

<script setup lang="ts">
  import GmChart from '@/gpumon/components/GmChart.vue'
  import { chartAxisStyle, CHART_COLORS, GM_MONO_FONT } from '@/gpumon/format'
  import { useSettingStore } from '@/store/modules/setting'
  import type { EChartsOption } from '@/plugins/echarts'

  export interface ToolUi {
    kind: string
    title?: string
    ctype?: string
    unit?: string
    x?: string[]
    series?: { name: string; data: number[] }[]
    columns?: { key: string; label: string }[]
    rows?: Record<string, unknown>[]
    items?: { k: string; v: string }[]
    cards?: ToolUi[]
  }

  defineOptions({ name: 'ToolCard' })
  const props = defineProps<{ ui: ToolUi }>()
  const settingStore = useSettingStore()

  const LINE_COLORS = [CHART_COLORS.gpu, CHART_COLORS.cpu, CHART_COLORS.mem, '#8f86c9', '#8b95a8', '#4f9e78']

  // 容器状态文字色（与容器页 chip 语义一致：运行=绿，退出/创建=灰，其余=告警）
  function stateColor(s: string): string {
    if (s === 'running' || s === '在线') return 'var(--gm-ok-text)'
    if (s === 'exited' || s === 'created' || s === '离线' || s === '') return 'var(--art-gray-500, #909399)'
    return 'var(--gm-hot-text)'
  }

  const wideCols: Record<string, number> = {
    cmd: 220, image: 150, home: 170, users: 150, detail: 220, res: 140, chain: 200
  }
  const colWidth = (k: string) => wideCols[k] ?? 76

  const chartOpt = computed<EChartsOption>(() => {
    const u = props.ui
    const ax = chartAxisStyle(settingStore.isDark)
    const many = (u.x?.length ?? 0) > 20
    const multi = (u.series?.length ?? 0) > 1
    return {
      color: LINE_COLORS,
      grid: { left: 46, right: 14, top: multi ? 32 : 14, bottom: many ? 44 : 26 },
      legend: multi ? { top: 0, itemWidth: 14, textStyle: { color: ax.label, fontSize: 11 } } : undefined,
      tooltip: {
        trigger: 'axis',
        backgroundColor: ax.tooltipBg,
        borderWidth: 0,
        textStyle: { color: ax.tooltipText, fontSize: 12 },
        valueFormatter: (v: unknown) => `${v}${u.unit ?? ''}`
      },
      xAxis: {
        type: 'category',
        data: u.x,
        axisLabel: { color: ax.label, fontSize: 10, fontFamily: GM_MONO_FONT, rotate: many ? 40 : 0 },
        axisLine: { lineStyle: { color: ax.split } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: ax.label, fontSize: 10, fontFamily: GM_MONO_FONT },
        splitLine: { lineStyle: { color: ax.split } }
      },
      series: (u.series ?? []).map((s) => ({
        name: s.name,
        type: (u.ctype === 'bar' ? 'bar' : 'line') as 'line',
        data: s.data,
        smooth: true,
        showSymbol: false,
        barMaxWidth: 16,
        lineStyle: { width: 1.6 }
      }))
    } as EChartsOption
  })
</script>

<style scoped lang="scss">
  .tc-title {
    margin-bottom: 6px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--art-gray-700, #606266);
  }

  .tc-count {
    margin-top: 4px;
    font-size: 11.5px;
    color: var(--art-gray-500, #909399);
  }

  .tc-kv {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;

    .k {
      display: inline-block;
      width: 110px;
      color: var(--art-gray-500, #909399);
    }
  }
</style>

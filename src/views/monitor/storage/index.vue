<!-- 存储：共享盘总览 / 目录用量表（点击看 30 天趋势）/ 集群总量趋势 -->
<template>
  <div>
    <template v-if="snap">
      <ElRow :gutter="20" class="flex flex-wrap">
        <ElCol :sm="24" :lg="8" class="flex mb-5 max-sm:mb-4">
          <div class="art-card p-5 w-full">
            <h3 class="text-base font-medium mb-4">共享盘</h3>
            <div class="flex justify-center">
              <RingGauge
                :pct="snap.disk?.used_pct ?? 0"
                :big="`${snap.disk?.used_pct ?? '-'}`"
                unit="%"
                :label="snap.disk?.path ?? ''"
                :cap="snap.disk ? `${(snap.disk.used_gb / 1024).toFixed(1)} / ${(snap.disk.total_gb / 1024).toFixed(1)}T` : ''"
              />
            </div>
            <div class="gm-kv mt-4">
              <div class="row"><span class="k">扫描状态</span><span class="v">{{ scanLine }}</span></div>
              <div class="row" v-if="st?.last_error"><span class="k">上次错误</span><span class="v" style="color: var(--gm-hot)">{{ st.last_error }}</span></div>
              <div class="row"><span class="k">扫描窗口</span><span class="v gm-num">{{ String(st?.scan_hour ?? 2).padStart(2, '0') }}:00 起 {{ st?.scan_window }}h · CPU&lt;{{ st?.cpu_threshold }}%</span></div>
            </div>
          </div>
        </ElCol>
        <ElCol :sm="24" :lg="16" class="flex mb-5 max-sm:mb-4">
          <div class="art-card p-5 w-full">
            <h3 class="text-base font-medium mb-4">集群总量趋势</h3>
            <GmChart v-if="trendData.length > 1" :option="trendOption" height="16rem" />
            <p v-else class="text-xs text-g-500">趋势数据不足（每日扫描后累积）</p>
          </div>
        </ElCol>
      </ElRow>

      <div class="art-card p-5 mb-5 max-sm:mb-4">
        <div class="flex-b mb-4">
          <h3 class="text-base font-medium">
            目录占用地图
            <span class="ml-2 text-xs font-normal text-g-500">块面积=用量 · 颜色=目录归属 · 点击看 30 天趋势</span>
          </h3>
          <span class="text-xs text-g-500 gm-num">{{ fmtB(st?.total_bytes ?? 0) }} 总量</span>
        </div>
        <GmChart v-if="dirRows.length" :option="treemapOption" height="20rem" @select="onTreemapPick" />
        <p v-else class="text-xs text-g-500">暂无扫描数据</p>
      </div>

      <div class="art-card p-5 mb-5 max-sm:mb-4">
        <div class="flex-b mb-4">
          <h3 class="text-base font-medium">目录用量（{{ st?.users?.length ?? 0 }} 个）</h3>
          <span class="text-xs text-g-500">点击行查看近 30 天趋势</span>
        </div>
        <ElTable :data="shownDirRows" size="small" @row-click="openHistory" style="cursor: pointer">
          <ElTableColumn label="#" width="60">
            <template #default="{ $index }"><span class="gm-num">{{ $index + 1 }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="目录" width="160">
            <template #default="{ row }"><span class="uchip" :style="{ '--c': userColor(row.name) }">{{ row.name }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="用量" width="110" sortable prop="bytes" align="right">
            <template #default="{ row }"><span class="gm-num font-semibold">{{ fmtB(row.bytes) }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="7 日增量" width="120" sortable prop="delta7d" align="right">
            <template #default="{ row }">
              <span
                v-if="row.delta7d != null && Math.abs(row.delta7d) >= 1e8"
                class="gm-num"
                :style="{
                  color: row.delta7d > 500e9 ? 'var(--gm-hot-text)' : row.delta7d > 0 ? 'var(--gm-warn-text)' : 'var(--gm-ok-text)',
                  fontWeight: row.delta7d > 500e9 ? 600 : 400
                }"
              >{{ fmtDelta(row.delta7d) }}</span>
              <span v-else class="text-xs text-g-500">-</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="占比" width="90" align="right">
            <template #default="{ row }"><span class="gm-num">{{ row.pct.toFixed(1) }}%</span></template>
          </ElTableColumn>
          <ElTableColumn label="">
            <template #default="{ row }">
              <!-- 条宽按列内最大值归一化（最大占比常只有 ~20%，按绝对值画全列都缩在最左） -->
              <div class="gm-bar" style="max-width: 420px" :title="`占共享盘 ${row.pct.toFixed(1)}%`">
                <i :style="{ width: (row.pct / maxDirPct) * 100 + '%', background: userColor(row.name), '--g': userColor(row.name) }" />
              </div>
            </template>
          </ElTableColumn>
        </ElTable>
        <div v-if="dirRows.length > 20" class="text-center mt-3">
          <ElButton link type="primary" size="small" @click="showAllDirs = !showAllDirs">
            {{ showAllDirs ? '收起' : `展开其余 ${dirRows.length - 20} 项（占比合计 ${restPct}%）` }}
          </ElButton>
        </div>
      </div>

      <ElDrawer v-model="drawer" :title="`${histName} · 近 30 天用量`" size="46%">
        <div class="px-2">
          <GmChart v-if="histData.length > 1" :option="histOption" height="18rem" />
          <p v-else class="text-xs text-g-500">历史数据不足</p>
          <p class="mt-3 text-xs text-g-500">单位 GB · 当前 {{ fmtB(histCurrent) }}</p>
        </div>
      </ElDrawer>
    </template>
    <ElSkeleton v-else :rows="8" animated class="art-card p-5" />
  </div>
</template>

<script setup lang="ts">
  import { useStatusStore } from '@/gpumon/store'
  import { apiGet } from '@/gpumon/api'
  import { fmtB, fmtDelta, fmtDateTime, userColor, onColorText, chartAxisStyle, GM_MONO_FONT, CHART_COLORS } from '@/gpumon/format'
  import RingGauge from '@/gpumon/components/RingGauge.vue'
  import GmChart from '@/gpumon/components/GmChart.vue'
  import { useSettingStore } from '@/store/modules/setting'
  import type { StorageHistoryResp, StorageUser } from '@/gpumon/types'
  import type { EChartsOption } from '@/plugins/echarts'
  import { ElMessage } from 'element-plus'

  defineOptions({ name: 'Storage' })

  const store = useStatusStore()
  onMounted(() => store.startPolling(10000))
  const snap = computed(() => store.snap)
  const st = computed(() => snap.value?.storage)

  const scanLine = computed(() => {
    const s = st.value
    if (!s) return '-'
    if (s.scanning) return `扫描中… 已扫 ${s.prog_dirs ?? 0} 个目录 / ${fmtB(s.prog_bytes ?? 0)}${s.prog_cur ? ' · ' + s.prog_cur : ''}`
    const last = s.last_scan && !s.last_scan.startsWith('0001')
      ? fmtDateTime(s.last_scan) : '从未'
    return `上次 ${last}${s.duration_sec ? `（耗时 ${(s.duration_sec / 60).toFixed(0)} 分钟）` : ''}`
  })

  const dirRows = computed(() => {
    const total = st.value?.total_bytes || 1
    return (st.value?.users ?? []).map((u) => ({ ...u, pct: (u.bytes / total) * 100 }))
  })

  // 目录表条形归一化基准：列内最大占比
  const maxDirPct = computed(() => {
    let m = 0.1
    for (const r of dirRows.value) if (r.pct > m) m = r.pct
    return m
  })

  // 长尾折叠：默认 Top 20
  const showAllDirs = ref(false)
  const shownDirRows = computed(() => (showAllDirs.value ? dirRows.value : dirRows.value.slice(0, 20)))
  const restPct = computed(() =>
    dirRows.value
      .slice(20)
      .reduce((a, r) => a + r.pct, 0)
      .toFixed(1)
  )

  const trendLabels = computed(() => (st.value?.trend ?? []).map((t) => t.date.slice(5)))
  const trendData = computed(() =>
    (st.value?.trend ?? []).map((t) => Math.round(t.total_bytes / 1e10) / 100) // TB
  )

  const settingStore = useSettingStore()
  const ax = computed(() => chartAxisStyle(settingStore.isDark))

  // 总量趋势：Y 轴自适应（不从 0 起，否则 55T 量级的日变化被压平）
  const trendOption = computed<EChartsOption>(() => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: ax.value.tooltipBg,
      borderWidth: 0,
      textStyle: { color: ax.value.tooltipText, fontSize: 12 },
      valueFormatter: (v) => `${v} TB`
    },
    grid: { left: 8, right: 8, top: 18, bottom: 2, containLabel: true },
    xAxis: {
      type: 'category',
      data: trendLabels.value,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: ax.value.label, fontSize: 11, fontFamily: GM_MONO_FONT }
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: ax.value.label, fontSize: 11, formatter: '{value}T' },
      splitLine: { lineStyle: { color: ax.value.split } }
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: trendData.value,
        lineStyle: { width: 2, color: CHART_COLORS.gpu },
        itemStyle: { color: CHART_COLORS.gpu },
        areaStyle: { color: CHART_COLORS.gpu, opacity: 0.08 }
      }
    ]
  }))

  // 目录占用 treemap：面积=字节，颜色=目录哈希色
  const treemapOption = computed<EChartsOption>(() => ({
    tooltip: {
      backgroundColor: ax.value.tooltipBg,
      borderWidth: 0,
      textStyle: { color: ax.value.tooltipText, fontSize: 12 },
      formatter: (p: any) => `${p.name} · ${fmtB(p.value)}（${((p.value / (st.value?.total_bytes || 1)) * 100).toFixed(1)}%）`
    },
    series: [
      {
        type: 'treemap',
        roam: false,
        nodeClick: false as const,
        breadcrumb: { show: false },
        width: '100%',
        height: '100%',
        top: 0,
        left: 0,
        itemStyle: { borderColor: ax.value.cardBg, borderWidth: 2, gapWidth: 2 },
        label: {
          fontFamily: GM_MONO_FONT,
          fontSize: 12,
          // 小块面积不足以放两行：<1.2% 只显示名称，<0.4% 不显示（避免数值被截半误导）
          formatter: (p: any) => {
            const pct = p.value / (st.value?.total_bytes || 1)
            if (pct < 0.004) return ''
            if (pct < 0.012) return p.name
            return `${p.name}\n${fmtB(p.value)}`
          }
        },
        emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.4)' } },
        data: dirRows.value.map((r) => ({
          name: r.name,
          value: r.bytes,
          itemStyle: { color: userColor(r.name) },
          // 浅色块（黄绿系）配白字对比不足，按块背景亮度切黑/白
          label: { color: onColorText(userColor(r.name)) }
        }))
      }
    ]
  }))

  function onTreemapPick(p: { name: string }) {
    const row = dirRows.value.find((r) => r.name === p.name)
    if (row) openHistory(row)
  }

  // 单目录 30 天趋势（抽屉）
  const histOption = computed<EChartsOption>(() => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: ax.value.tooltipBg,
      borderWidth: 0,
      textStyle: { color: ax.value.tooltipText, fontSize: 12 },
      valueFormatter: (v) => `${v} GB`
    },
    grid: { left: 8, right: 8, top: 18, bottom: 2, containLabel: true },
    xAxis: {
      type: 'category',
      data: histLabels.value,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: ax.value.label, fontSize: 11, fontFamily: GM_MONO_FONT }
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: ax.value.label, fontSize: 11, formatter: '{value}G' },
      splitLine: { lineStyle: { color: ax.value.split } }
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: histData.value,
        lineStyle: { width: 2, color: histColor.value },
        itemStyle: { color: histColor.value },
        areaStyle: { color: histColor.value, opacity: 0.1 }
      }
    ]
  }))
  const histColor = computed(() => userColor(histName.value || 'x'))

  // 单目录 30 天趋势
  const drawer = ref(false)
  const histName = ref('')
  const histLabels = ref<string[]>([])
  const histData = ref<number[]>([])
  const histCurrent = ref(0)

  async function openHistory(row: StorageUser) {
    histName.value = row.name
    drawer.value = true
    try {
      const r = await apiGet<StorageHistoryResp>(`/api/storage/history?name=${encodeURIComponent(row.name)}`)
      histLabels.value = r.days.map((d) => d.date.slice(5))
      histData.value = r.days.map((d) => Math.round(d.bytes / 1e7) / 100) // GB
      histCurrent.value = r.current_bytes ?? row.bytes
    } catch (e) {
      ElMessage.error('趋势获取失败：' + e)
    }
  }

  // ---- 深链：?dir=xxx → 直接打开该目录 30 天趋势抽屉 ----
  const route = useRoute()
  const located = ref('')
  watch(
    () => [dirRows.value.length > 0, route.query.dir] as const,
    ([ready]) => {
      const target = String(route.query.dir ?? '')
      if (!ready || !target || located.value === target) return
      const row = dirRows.value.find((r) => r.name === target)
      if (!row) return
      located.value = target
      openHistory(row)
    },
    { immediate: true }
  )
</script>

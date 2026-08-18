<!-- 概览（驾驶舱）：KPI+迷你趋势 / 合并监控图（今天·近30天·实时） / 状态圆环 / 热度墙 / 排行 / 节点一览 -->
<template>
  <div>
    <template v-if="snap && c">
      <ElAlert
        v-for="ev in recentEvents.slice(0, 3)"
        :key="ev.ts + ev.user"
        :type="ev.dry_run ? 'warning' : 'error'"
        :closable="false"
        show-icon
        class="mb-3"
      >
        {{ fmtTime(ev.ts) }} · 用户 {{ ev.user }} 占用 {{ ev.using }} 卡，超过限额 {{ ev.limit }} 卡 ——
        {{ ev.dry_run ? '干跑记录（未实际终止）' : '超限任务已终止' }}
      </ElAlert>

      <!-- KPI 卡（带今日迷你趋势线） -->
      <ElRow :gutter="20" class="flex">
        <ElCol v-for="k in kpis" :key="k.label" :sm="12" :md="6">
          <div
            class="art-card relative flex flex-col justify-center h-35 px-5 mb-5 max-sm:mb-4 overflow-hidden"
            :class="{ 'cursor-pointer': k.to }"
            @click="k.to && router.push(k.to)"
          >
            <span class="text-g-700 text-sm">{{ k.label }}</span>
            <div class="flex items-baseline mt-2">
              <ArtCountTo
                class="text-[26px] font-medium gm-num"
                :target="k.value"
                :decimals="k.decimals ?? 0"
                :duration="1200"
              />
              <span v-if="k.suffix" class="ml-1 text-sm text-g-500 gm-num">{{ k.suffix }}</span>
            </div>
            <div class="flex-c mt-1">
              <span class="text-xs text-g-600">{{ k.sub }}</span>
            </div>
            <div class="absolute top-0 right-5 mt-5 size-12.5 rounded-xl flex-cc bg-theme/10">
              <ArtSvgIcon :icon="k.icon" class="text-xl text-theme" />
            </div>
            <svg v-if="k.spark?.length" class="gm-spark" viewBox="0 0 100 34" preserveAspectRatio="none">
              <polyline
                :points="sparkPoints(k.spark)"
                fill="none"
                stroke="var(--gm-accent)"
                stroke-width="1.5"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
                opacity="0.85"
              />
              <polygon :points="sparkArea(k.spark)" fill="var(--gm-accent)" opacity="0.10" />
            </svg>
          </div>
        </ElCol>
      </ElRow>

      <!-- 监控合并图 + 状态圆环 -->
      <ElRow :gutter="20" class="flex flex-wrap">
        <ElCol :sm="24" :lg="14" class="flex mb-5 max-sm:mb-4">
          <div class="art-card p-5 w-full">
            <div class="flex-b mb-3 flex-wrap gap-2">
              <h3 class="text-base font-medium">
                集群监控
                <span class="ml-1 text-xs font-normal text-g-500 cursor-help" :title="chartHint">ⓘ</span>
              </h3>
              <ElRadioGroup v-model="chartRange" size="small">
                <ElRadioButton value="today">今天</ElRadioButton>
                <ElRadioButton value="30d">近 30 天</ElRadioButton>
                <ElRadioButton value="rt">实时</ElRadioButton>
              </ElRadioGroup>
            </div>
            <GmChart v-if="chartReady" :option="chartOption" height="17rem" />
            <div v-else class="flex-cc text-g-500 text-sm" style="height: 17rem">正在采样，稍等片刻…</div>
          </div>
        </ElCol>
        <ElCol :sm="24" :lg="10" class="flex mb-5 max-sm:mb-4">
          <div class="art-card p-5 w-full">
            <h3 class="text-base font-medium mb-4">状态</h3>
            <div class="grid grid-cols-2 gap-2 justify-items-center">
              <div class="cursor-pointer" @click="router.push('/gpu')">
                <RingGauge
                  :pct="c.gpu_util_avg" :big="`${c.gpu_util_avg}`" unit="%" kind="load"
                  label="GPU 利用率" :cap="`${c.gpu_in_use}/${c.gpu_alloc_total} 卡在用`"
                />
              </div>
              <div class="cursor-pointer" @click="router.push('/gpu')">
                <RingGauge
                  :pct="gpuMemPct" :big="gpuMemPct.toFixed(0)" unit="%"
                  label="显存" :cap="`${fmtT(c.gpu_mem_used_mb)} / ${fmtT(c.gpu_mem_total_mb)}`"
                />
              </div>
              <div class="cursor-pointer" @click="router.push('/host')">
                <RingGauge
                  :pct="c.cpu_pct_avg" :big="`${c.cpu_pct_avg}`" unit="%" kind="load"
                  label="CPU" :cap="`${c.cores_total} 核 · 内存 ${memPct.toFixed(0)}%`"
                />
              </div>
              <div class="cursor-pointer" @click="router.push('/storage')">
                <RingGauge
                  :pct="snap.disk?.used_pct ?? 0" :big="`${snap.disk?.used_pct ?? '-'}`" unit="%"
                  label="共享盘"
                  :cap="snap.disk ? `${(snap.disk.used_gb / 1024).toFixed(1)} / ${(snap.disk.total_gb / 1024).toFixed(1)}T` : ''"
                />
              </div>
            </div>
          </div>
        </ElCol>
      </ElRow>

      <!-- 热度墙（签名元素，点格子跳对应卡） -->
      <div class="art-card p-5 mb-5 max-sm:mb-4">
        <div class="flex-b mb-4">
          <h3 class="text-base font-medium">
            节点 GPU 热度
            <span class="ml-2 text-xs font-normal text-g-500">每格一张卡 · 数字为利用率 · 底部色条为占用者 · 点击直达该卡</span>
          </h3>
          <RouterLink class="text-theme text-xs" to="/gpu">GPU 详情 →</RouterLink>
        </div>
        <HeatWall :nodes="store.allocNodes" />
      </div>

      <!-- 排行 + 集群信息（同行等高） -->
      <ElRow :gutter="20" class="flex flex-wrap">
        <ElCol :sm="24" :md="8" class="flex mb-5 max-sm:mb-4">
          <div class="art-card p-5 w-full">
            <div class="flex-b mb-3">
              <h3 class="text-base font-medium">今日卡时</h3>
              <RouterLink class="text-theme text-xs" to="/users">全部用户 →</RouterLink>
            </div>
            <BarList :rows="topUsers" empty="今日暂无 GPU 使用" @pick="(u) => router.push({ path: '/users', query: { user: u } })" />
          </div>
        </ElCol>
        <ElCol :sm="24" :md="8" class="flex mb-5 max-sm:mb-4">
          <div class="art-card p-5 w-full">
            <div class="flex-b mb-3">
              <h3 class="text-base font-medium">共享存储</h3>
              <RouterLink class="text-theme text-xs" to="/storage">全部目录 →</RouterLink>
            </div>
            <BarList :rows="topStorage" @pick="(d) => router.push({ path: '/storage', query: { dir: d } })" />
          </div>
        </ElCol>
        <ElCol :sm="24" :md="8" class="flex mb-5 max-sm:mb-4">
          <div class="art-card p-5 w-full">
            <h3 class="text-base font-medium mb-4">集群信息</h3>
            <div class="gm-kv">
              <div class="row"><span class="k">计算节点</span><span class="v">{{ store.allocNodes.length }} 台（{{ nodeMakeup }}）</span></div>
              <div class="row"><span class="k">GPU 总数</span><span class="v gm-num">{{ c.gpu_alloc_total }} 张 · {{ c.cores_total }} 核</span></div>
              <div class="row"><span class="k">内存合计</span><span class="v gm-num">{{ fmtT(c.mem_used_mb) }} / {{ fmtT(c.mem_total_mb) }}</span></div>
              <div class="row"><span class="k">共享盘</span><span class="v gm-num">{{ snap.disk?.path ?? '-' }}</span></div>
              <div class="row"><span class="k">存储扫描</span><span class="v">{{ scanLine }}</span></div>
              <div class="row"><span class="k">控制节点</span><span class="v">CPU {{ (snap.control?.cpu_pct ?? 0).toFixed(0) }}% · {{ snap.control?.hostname ?? '-' }}</span></div>
              <div class="row">
                <span class="k">归因模式</span>
                <span class="v">
                  {{ attrMode === 'account' ? '账号直读' : '路径推断' }}
                  <ElButton link type="primary" size="small" @click="toggleAttr">切换</ElButton>
                </span>
              </div>
            </div>
          </div>
        </ElCol>
      </ElRow>

      <div class="art-card p-5 mb-5 max-sm:mb-4">
        <h3 class="text-base font-medium mb-4">节点一览 <span class="ml-2 text-xs font-normal text-g-500">点击行查看该节点 GPU 明细</span></h3>
        <ElTable :data="nodeRows" size="small" @row-click="(row: any) => router.push({ path: '/gpu', query: { node: row.name } })" :row-style="{ cursor: 'pointer' }">
          <ElTableColumn prop="name" label="节点" width="120">
            <template #default="{ row }"><span class="gm-num font-semibold">{{ row.name }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="类型" width="80">
            <template #default="{ row }">
              <span class="gm-tag" :class="row.type === 'A100' ? 'a100' : 'l40s'">{{ row.type }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="GPU 在用" width="90">
            <template #default="{ row }"><span class="gm-num">{{ row.gpu }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="CPU">
            <template #default="{ row }">
              <div class="gm-cellbar">
                <div class="gm-bar"><i :style="loadBarStyle(row.cpu)" /></div>
                <span class="gm-num">{{ row.cpu.toFixed(0) }}%</span>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="内存">
            <template #default="{ row }">
              <div class="gm-cellbar">
                <div class="gm-bar"><i :style="barStyle(row.mem)" /></div>
                <span class="gm-num">{{ row.mem.toFixed(0) }}%</span>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="根分区">
            <template #default="{ row }">
              <div class="gm-cellbar">
                <div class="gm-bar"><i :style="barStyle(row.root)" /></div>
                <span class="gm-num">{{ row.root.toFixed(0) }}%</span>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="负载" width="70">
            <template #default="{ row }"><span class="gm-num">{{ row.load }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="docker 运行/总" width="110">
            <template #default="{ row }">
              <span
                class="gm-num cursor-pointer text-theme"
                title="查看该节点容器"
                @click.stop="router.push({ path: '/docker', query: { node: row.name } })"
              >{{ row.docker }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="状态" width="70">
            <template #default="{ row }">
              <span :style="{ color: row.online ? 'var(--gm-ok)' : 'var(--gm-hot)' }">{{ row.online ? '在线' : '离线' }}</span>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </template>

    <ElSkeleton v-else-if="store.loading" :rows="8" animated class="art-card p-5" />
    <ElAlert v-else type="error" :closable="false" show-icon>
      数据获取失败：{{ store.error }}（每 10 秒自动重试）
    </ElAlert>
  </div>
</template>

<script setup lang="ts">
  import { useStatusStore } from '@/gpumon/store'
  import { apiGet, apiPost } from '@/gpumon/api'
  import { fmtT, fmtB, fmtTime, fmtDateTime, utilColor, loadColor, userColor, CHART_COLORS } from '@/gpumon/format'
  import HeatWall from '@/gpumon/components/HeatWall.vue'
  import BarList, { type BarRow } from '@/gpumon/components/BarList.vue'
  import RingGauge from '@/gpumon/components/RingGauge.vue'
  import GmChart from '@/gpumon/components/GmChart.vue'
  import type { SeriesResp, SeriesPoint, UsageResp } from '@/gpumon/types'
  import { useSettingStore } from '@/store/modules/setting'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { EChartsOption } from '@/plugins/echarts'

  defineOptions({ name: 'Overview' })

  const store = useStatusStore()
  const settingStore = useSettingStore()
  const router = useRouter()
  onMounted(() => store.startPolling(10000))

  const snap = computed(() => store.snap)
  const c = computed(() => snap.value?.cluster)

  const recentEvents = computed(() =>
    (snap.value?.enforce_events ?? []).filter(
      (ev) => Date.now() - new Date(ev.ts).getTime() < 30 * 60 * 1000
    )
  )

  // ---- 后端时序（分钟级，48h）与按天用量 ----
  const series = ref<SeriesPoint[]>([])
  const usage = ref<UsageResp | null>(null)
  let seriesTimer: ReturnType<typeof setInterval> | 0 = 0

  async function fetchSeries() {
    try {
      const r = await apiGet<SeriesResp>('/api/series')
      series.value = r.points ?? []
    } catch {
      /* 静默：图表回退到实时采样 */
    }
  }
  async function fetchUsage() {
    try {
      usage.value = await apiGet<UsageResp>('/api/usage')
    } catch {
      /* 静默 */
    }
  }
  onMounted(() => {
    fetchSeries()
    fetchUsage()
    seriesTimer = setInterval(fetchSeries, 60000)
  })
  onUnmounted(() => {
    if (seriesTimer) clearInterval(seriesTimer)
  })

  const todayPoints = computed(() => {
    const d0 = new Date()
    d0.setHours(0, 0, 0, 0)
    const cut = d0.getTime() / 1000
    return series.value.filter((p) => p.t >= cut)
  })

  const hoursToday = computed(() =>
    (snap.value?.users ?? []).reduce((a, u) => a + (u.gpu_hours_today || 0), 0)
  )

  // ---- KPI（GPU 在用与今日卡时带迷你趋势线） ----
  const sparkGpuUsed = computed(() => todayPoints.value.map((p) => p.gpu_used))
  const sparkHours = computed(() => {
    let acc = 0
    return todayPoints.value.map((p) => (acc += p.gpu_used / 60))
  })

  const sparkCpu = computed(() => todayPoints.value.map((p) => p.cpu))
  const sparkAu = computed(() => todayPoints.value.map((p) => p.au ?? 0))

  const kpis = computed(() => {
    const cc = c.value!
    return [
      {
        label: 'GPU 在用',
        value: cc.gpu_in_use,
        suffix: `/ ${cc.gpu_alloc_total}`,
        sub: `平均利用率 ${cc.gpu_util_avg}% · 空闲 ${Math.max(0, cc.gpu_alloc_total - cc.gpu_in_use)} 张`,
        icon: 'ri:cpu-line',
        spark: sparkGpuUsed.value,
        to: '/gpu'
      },
      {
        label: '节点在线',
        value: cc.nodes_online,
        suffix: `/ ${cc.nodes_total}`,
        sub: `集群 CPU ${cc.cpu_pct_avg}%`,
        icon: 'ri:server-line',
        spark: sparkCpu.value,
        to: '/host'
      },
      {
        label: '活跃用户',
        value: cc.active_users,
        sub: '当前占用 GPU 的用户数',
        icon: 'ri:group-line',
        spark: sparkAu.value,
        to: '/users'
      },
      {
        label: '今日卡时',
        value: hoursToday.value,
        decimals: 1,
        sub: '实时累计，午夜归档',
        icon: 'ri:time-line',
        spark: sparkHours.value,
        to: '/users'
      }
    ]
  })

  function sparkPoints(data: number[]): string {
    if (data.length < 2) return ''
    const max = Math.max(...data, 0.001)
    const min = Math.min(...data, 0)
    const span = Math.max(max - min, 0.001)
    return data
      .map((v, i) => `${((i / (data.length - 1)) * 100).toFixed(2)},${(32 - ((v - min) / span) * 28 + 1).toFixed(2)}`)
      .join(' ')
  }
  function sparkArea(data: number[]): string {
    const line = sparkPoints(data)
    return line ? `0,34 ${line} 100,34` : ''
  }

  const gpuMemPct = computed(() =>
    c.value?.gpu_mem_total_mb ? (c.value.gpu_mem_used_mb / c.value.gpu_mem_total_mb) * 100 : 0
  )
  const memPct = computed(() =>
    c.value?.mem_total_mb ? (c.value.mem_used_mb / c.value.mem_total_mb) * 100 : 0
  )

  const nodeMakeup = computed(() => {
    const cnt: Record<string, number> = {}
    for (const n of store.allocNodes) cnt[n.type] = (cnt[n.type] ?? 0) + 1
    return Object.entries(cnt)
      .map(([t, n]) => `${n}×${t}`)
      .join(' + ')
  })

  const scanLine = computed(() => {
    const st = snap.value?.storage
    if (!st) return '-'
    if (st.scanning) return `扫描中… 已扫 ${st.prog_dirs ?? 0} 个目录 / ${fmtB(st.prog_bytes ?? 0)}`
    const last =
      st.last_scan && !st.last_scan.startsWith('0001') ? fmtDateTime(st.last_scan) : '从未'
    return `每日 ${String(st.scan_hour ?? 2).padStart(2, '0')}:00 · 上次 ${last}`
  })

  // ---- 归因模式 ----
  const attrOverride = ref<'legacy' | 'account' | null>(null)
  const attrMode = computed(() => attrOverride.value ?? snap.value?.attr_mode ?? 'legacy')
  watch(
    () => snap.value?.attr_mode,
    (v) => {
      if (v && v === attrOverride.value) attrOverride.value = null
    }
  )
  async function toggleAttr() {
    const next = attrMode.value === 'account' ? 'legacy' : 'account'
    const desc =
      next === 'account'
        ? '切换为「账号直读」：进程归属直接取进程属主（实名账号）；user01/root 等共享账号仍走路径推断，容器仍按挂载源判定。'
        : '切换回「路径推断」：全部按挂载源 / cwd / 命令行级联推断（过渡期老逻辑）。'
    try {
      await ElMessageBox.confirm(desc + ' 下一轮采集（≤15s）生效，确定？', '切换归因模式', {
        confirmButtonText: '切换',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    try {
      await apiPost('/api/attribution', { mode: next })
      attrOverride.value = next
      ElMessage.success(next === 'account' ? '已切换为账号直读' : '已切换回路径推断')
    } catch (e) {
      ElMessage.error('切换失败：' + e)
    }
  }

  // ---- 合并监控图（今天 / 近30天 / 实时） ----
  const chartRange = ref<'today' | '30d' | 'rt'>('today')

  const chartReady = computed(() => {
    if (chartRange.value === 'today') return todayPoints.value.length > 1
    if (chartRange.value === '30d') return dayRows.value.length > 0
    return store.hist.length > 1
  })

  const chartHint = computed(() =>
    chartRange.value === 'today'
      ? '后端每分钟归档一个采样点，跨浏览器共享，重启续接'
      : chartRange.value === '30d'
        ? '按天用量日志（午夜归档）：柱=当日总卡时，线=卡数占用率'
        : '页面打开期间每 10s 采样一次，最长保留 1 小时'
  )

  // 近 30 天行：历史日志 + 今天（实时累计）
  const dayRows = computed(() => {
    const alloc = c.value?.gpu_alloc_total || 72
    const rows: { date: string; hours: number; occ: number }[] = []
    for (const d of usage.value?.history ?? []) {
      let sum = 0
      for (const k in d.users ?? {}) sum += d.users[k].gpu_hours || 0
      const wall = d.wall_hours > 0 ? d.wall_hours : 24
      rows.push({ date: d.date.slice(5), hours: sum, occ: Math.min(100, (sum / (alloc * wall)) * 100) })
    }
    const today = new Date()
    const wallToday = today.getHours() + today.getMinutes() / 60
    if (hoursToday.value > 0 && wallToday > 0.2) {
      rows.push({
        date: `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
        hours: hoursToday.value,
        occ: Math.min(100, (hoursToday.value / (alloc * wallToday)) * 100)
      })
    }
    return rows.slice(-30)
  })

  const axisStyle = computed(() => {
    const dark = settingStore.isDark
    return {
      label: dark ? '#8a8f99' : '#8b90a0',
      split: dark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)',
      tooltipBg: dark ? '#1b1d23' : '#fff',
      tooltipText: dark ? '#e3e5ea' : '#303133'
    }
  })

  const chartOption = computed<EChartsOption>(() => {
    const a = axisStyle.value
    const common = {
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: a.tooltipBg,
        borderWidth: 0,
        textStyle: { color: a.tooltipText, fontSize: 12 },
        axisPointer: { type: 'line' as const, lineStyle: { color: a.label, opacity: 0.4 } }
      },
      legend: {
        top: 0,
        right: 0,
        icon: 'roundRect',
        itemWidth: 10,
        itemHeight: 3,
        textStyle: { color: a.label, fontSize: 11 },
        // 网络两条线分钟级抖动大，默认收起，点图例可开
        selected: { 下行: false, 上行: false } as Record<string, boolean>
      },
      grid: { left: 8, right: 8, top: 30, bottom: 2, containLabel: true }
    }

    if (chartRange.value === '30d') {
      return {
        ...common,
        xAxis: {
          type: 'category',
          data: dayRows.value.map((r) => r.date),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: a.label, fontSize: 11, fontFamily: 'ui-monospace, SF Mono, Menlo, Consolas, monospace' }
        },
        yAxis: [
          {
            type: 'value',
            name: '占用率 %',
            max: 100,
            nameTextStyle: { color: a.label, fontSize: 11 },
            axisLabel: { color: a.label, fontSize: 11 },
            splitLine: { lineStyle: { color: a.split } }
          },
          {
            type: 'value',
            axisLabel: { color: a.label, fontSize: 11 },
            splitLine: { show: false }
          }
        ],
        series: [
          {
            name: '当日卡时',
            type: 'bar',
            yAxisIndex: 1,
            data: dayRows.value.map((r) => Math.round(r.hours * 10) / 10),
            itemStyle: { color: CHART_COLORS.hours, opacity: 0.45, borderRadius: [3, 3, 0, 0] },
            barMaxWidth: 18
          },
          {
            name: '卡数占用率',
            type: 'line',
            smooth: true,
            symbol: 'none',
            data: dayRows.value.map((r) => Math.round(r.occ * 10) / 10),
            lineStyle: { width: 2, color: CHART_COLORS.cpu },
            itemStyle: { color: CHART_COLORS.cpu }
          }
        ]
      }
    }

    // today / rt：多指标合一
    const raw =
      chartRange.value === 'today'
        ? todayPoints.value.map((p) => ({
            d: new Date(p.t * 1000), gpu: p.gpu, cpu: p.cpu, mem: p.mem, rx: p.rx, tx: p.tx
          }))
        : store.hist.map((p) => ({
            d: new Date(p.t), gpu: p.gpuUtil, cpu: p.cpuPct, mem: -1, rx: p.netRxKBs, tx: p.netTxKBs
          }))
    // time 轴 + [时间戳, 值] 数据：刻度天然落整点（category 轴按点数等分会切出 01:33 这种没法读的轴）
    const line = (name: string, key: 'gpu' | 'cpu' | 'mem', color: string, area = false) => ({
      name,
      type: 'line' as const,
      smooth: true,
      symbol: 'none' as const,
      data: raw.map((r) => [r.d.getTime(), Math.round(r[key] * 10) / 10]),
      lineStyle: { width: 2, color },
      itemStyle: { color },
      ...(area
        ? { areaStyle: { color, opacity: 0.08 } }
        : {})
    })
    const netLine = (name: string, key: 'rx' | 'tx', color: string) => ({
      name,
      type: 'line' as const,
      smooth: true,
      symbol: 'none' as const,
      yAxisIndex: 1,
      data: raw.map((r) => [r.d.getTime(), Math.round((r[key] / 1024) * 10) / 10]),
      lineStyle: { width: 1.2, type: 'dashed' as const, color },
      itemStyle: { color }
    })
    const series = [line('GPU 利用率', 'gpu', CHART_COLORS.gpu, true), line('CPU', 'cpu', CHART_COLORS.cpu)]
    if (chartRange.value === 'today') series.push(line('显存', 'mem', CHART_COLORS.mem))
    return {
      ...common,
      xAxis: {
        type: 'time',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: a.label,
          fontSize: 11,
          fontFamily: 'ui-monospace, SF Mono, Menlo, Consolas, monospace',
          formatter: '{HH}:{mm}',
          hideOverlap: true
        }
      },
      yAxis: [
        {
          type: 'value',
          max: 100,
          axisLabel: { color: a.label, fontSize: 11, formatter: '{value}%' },
          splitLine: { lineStyle: { color: a.split } }
        },
        {
          type: 'value',
          axisLabel: { color: a.label, fontSize: 11, formatter: '{value}M' },
          splitLine: { show: false }
        }
      ],
      series: [...series, netLine('下行', 'rx', CHART_COLORS.rx), netLine('上行', 'tx', CHART_COLORS.tx)]
    }
  })

  // ---- 排行 ----
  const topUsers = computed<BarRow[]>(() => {
    const us = [...(snap.value?.users ?? [])]
      .sort((a, b) => (b.gpu_hours_today || 0) - (a.gpu_hours_today || 0))
      .slice(0, 6)
    const max = Math.max(0.1, ...us.map((u) => u.gpu_hours_today || 0))
    return us.map((u) => ({
      label: u.user,
      pct: ((u.gpu_hours_today || 0) / max) * 100,
      value: (u.gpu_hours_today || 0).toFixed(1),
      color: userColor(u.user)
    }))
  })

  const topStorage = computed<BarRow[]>(() => {
    const st = snap.value?.storage
    if (!st?.users?.length) return []
    const total = st.total_bytes || 1
    return st.users.slice(0, 6).map((u) => ({
      label: u.name,
      pct: (u.bytes / total) * 100,
      value: fmtB(u.bytes),
      color: userColor(u.name)
    }))
  })

  const barStyle = (v: number) => ({
    width: Math.min(100, v) + '%',
    background: utilColor(v),
    '--g': utilColor(v)
  })

  const loadBarStyle = (v: number) => ({
    width: Math.min(100, v) + '%',
    background: loadColor(v),
    '--g': loadColor(v)
  })

  // ---- 节点表 ----
  const nodeRows = computed(() =>
    store.allocNodes.map((n) => {
      const used = new Set<number>()
      for (const p of n.procs ?? []) p.gpus.forEach((i) => used.add(i))
      return {
        name: n.name,
        type: n.type,
        online: n.online,
        gpu: `${used.size}/${(n.gpus ?? []).length}`,
        cpu: n.cpu_pct,
        mem: n.mem_total_mb ? (n.mem_used_mb / n.mem_total_mb) * 100 : 0,
        root: n.root_total_mb ? (n.root_used_mb / n.root_total_mb) * 100 : 0,
        docker: `${n.docker_running}/${n.docker_total}`,
        load: n.load1.toFixed(1)
      }
    })
  )
</script>

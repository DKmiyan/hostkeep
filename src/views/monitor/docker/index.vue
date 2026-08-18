<!-- 容器：总览图表（状态环/节点堆叠/镜像 Top）+ 节点聚焦模式（全部=每节点预览，聚焦=单节点全量内滚）
     + 实时资源（CPU/内存/PID，docker stats）+ 单删/批量清理（只动 exited/created/dead）
     深链：?node=聚焦某节点 ?user=&state=预置过滤 -->
<template>
  <div>
    <div class="art-card p-5 mb-5 max-sm:mb-4" v-if="resp">
      <div class="flex-b mb-3 flex-wrap gap-2">
        <h3 class="text-base font-medium">容器总览</h3>
        <div class="flex gap-2 items-center">
          <ElSelect v-model="filterUser" placeholder="按归属用户过滤" clearable size="small" style="width: 160px">
            <ElOption v-for="u in allUsers" :key="u" :label="u" :value="u" />
          </ElSelect>
          <ElButton size="small" @click="load" :loading="loading">刷新</ElButton>
        </div>
      </div>
      <div class="flex flex-wrap gap-2 mb-4">
        <button
          v-for="f in stateChips"
          :key="f.key"
          class="gm-chip"
          :class="{ active: filterState === f.key }"
          :style="{ '--cc': f.color }"
          @click="filterState = filterState === f.key ? '' : f.key"
        >
          <i class="dot" />{{ f.label }}
          <span class="gm-num n">{{ f.count }}</span>
        </button>
      </div>

      <ElRow :gutter="16">
        <ElCol :sm="24" :md="7">
          <p class="text-xs text-g-500 mb-1">状态分布</p>
          <GmChart :option="donutOption" height="200px" @select="onDonutPick" />
        </ElCol>
        <ElCol :sm="24" :md="10">
          <p class="text-xs text-g-500 mb-1">各节点容器（点击条形聚焦该节点）</p>
          <GmChart :option="nodeBarOption" height="200px" @select="(p) => focusNode(p.name)" />
        </ElCol>
        <ElCol :sm="24" :md="7">
          <p class="text-xs text-g-500 mb-1">镜像 Top 6（按容器数）</p>
          <GmChart :option="imageBarOption" height="200px" />
        </ElCol>
      </ElRow>

      <p class="mt-3 text-xs text-g-500">
        运行中内存合计 <span class="gm-num text-g-700">{{ fmtB(statSum.mem) }}</span>
        · 进程数合计 <span class="gm-num text-g-700">{{ statSum.pids }}</span>
        · 已停止可回收 RW 层 <span class="gm-num text-g-700">{{ fmtB(statSum.rw) }}</span>
        —— 清理只删除 exited / created / dead 状态，节点上执行前逐个复核；操作记入 enforce 日志
      </p>
    </div>

    <!-- 节点条：全部 / 单节点聚焦 -->
    <div v-if="resp" class="gm-nodenav" style="position: static; box-shadow: none">
      <span
        class="nn"
        :class="{ 'nn-on': !focusedNode }"
        role="link"
        tabindex="0"
        @click="focusNode('')"
        @keydown.enter="focusNode('')"
      ><i class="dot" style="--dc: var(--gm-accent)" />全部节点</span>
      <span
        v-for="n in shownNodes"
        :key="n.name"
        class="nn"
        :class="{ 'nn-on': focusedNode === n.name }"
        role="link"
        tabindex="0"
        :style="{ '--dc': n.online ? 'var(--gm-ok)' : 'var(--gm-hot)' }"
        @click="focusNode(n.name)"
        @keydown.enter="focusNode(n.name)"
      >
        <i class="dot" />{{ n.name }}
        <span class="gm-num text-g-500">{{ n.running ?? 0 }}/{{ n.total ?? 0 }}</span>
      </span>
    </div>

    <template v-if="resp">
      <div v-for="n in visibleNodes" :key="n.name" class="art-card p-5 mb-5 max-sm:mb-4">
        <div class="flex-b mb-3 flex-wrap gap-2">
          <h3 class="text-base font-medium">
            <span class="gm-num">{{ n.name }}</span>
            <ElTag v-if="n.role === 'ib-test'" size="small" type="info" class="ml-2" title="IB 测试机：不进集群统计，其余页面不展示">IB 测试</ElTag>
            <span class="ml-2 text-xs font-normal text-g-500 gm-num">运行 {{ n.running }}/{{ n.total }}</span>
            <span v-if="!n.online" class="ml-2 text-sm" style="color: var(--gm-hot)">离线</span>
          </h3>
          <div class="flex gap-2 items-center">
            <ElButton
              v-if="stoppedCount(n) > 0"
              size="small"
              type="danger"
              plain
              @click="prune(n.name)"
            >
              清理已停止（{{ stoppedCount(n) }}{{ filterUser ? ` · ${filterUser}` : '' }}）
            </ElButton>
            <ElButton v-if="focusedNode" size="small" @click="focusNode('')">← 返回全部节点</ElButton>
          </div>
        </div>

        <ElTable
          v-if="rowsOf(n).length"
          :data="rowsOf(n)"
          size="small"
          :max-height="focusedNode ? 560 : undefined"
        >
          <ElTableColumn label="容器" min-width="210" show-overflow-tooltip>
            <template #default="{ row }"><span class="gm-num text-xs">{{ row.name }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="状态" width="105">
            <template #default="{ row }">
              <ElTag size="small" :type="row.state === 'running' ? 'success' : isStopped(row.state) ? 'info' : 'warning'">
                {{ row.state }}<span
                  v-if="row.state === 'exited'"
                  :style="row.exit_code ? 'color: var(--gm-hot-text); font-weight: 600' : ''"
                >({{ row.exit_code }})</span>
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="归属" width="100">
            <template #default="{ row }">
              <span v-if="row.user" class="uchip" :style="{ '--c': userColor(row.user) }">{{ row.user }}</span>
              <span v-else class="text-xs text-g-500">-</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="GPU" width="70">
            <template #default="{ row }">
              <ElTag
                v-if="gpusOf(n.name, row.name).length"
                size="small"
                type="warning"
                class="gm-num cursor-pointer"
                :title="`占用 GPU ${gpusOf(n.name, row.name).join(',')} · 点击查看`"
                @click="router.push({ path: '/gpu', query: { node: n.name } })"
              >×{{ gpusOf(n.name, row.name).length }}</ElTag>
              <span v-else class="text-xs text-g-500">-</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="CPU" width="80" align="right">
            <template #default="{ row }">
              <!-- 有内存数据说明本轮 stats 采到了；cpu_pct 为 0 时后端 omitempty 省略 → 显示 0% -->
              <span
                v-if="row.state === 'running' && (row.cpu_pct != null || row.mem_used_b)"
                class="gm-num text-xs"
                :style="{ color: loadTextColor(Math.min(100, (row.cpu_pct ?? 0) / 8)) }"
              >{{ (row.cpu_pct ?? 0).toFixed(0) }}%</span>
              <!-- 停止容器无实时资源属正常，留空；运行中缺采才显示 - -->
              <span v-else-if="row.state === 'running'" class="text-xs text-g-500">-</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="内存" width="150">
            <template #default="{ row }">
              <div v-if="row.state === 'running' && row.mem_used_b" class="gm-cellbar" style="min-width: 130px">
                <div class="gm-bar">
                  <i :style="{ width: Math.min(100, row.mem_pct ?? 0) + '%', background: utilColor(row.mem_pct ?? 0), '--g': utilColor(row.mem_pct ?? 0) }" />
                </div>
                <span class="gm-num text-xs" style="width: 52px">{{ fmtB(row.mem_used_b) }}</span>
              </div>
              <span v-else-if="row.state === 'running'" class="text-xs text-g-500">-</span>
            </template>
          </ElTableColumn>
          <ElTableColumn v-if="focusedNode" label="PID" width="70" align="right">
            <template #default="{ row }">
              <span v-if="row.pids" class="gm-num text-xs">{{ row.pids }}</span>
              <span v-else-if="row.state === 'running'" class="text-xs text-g-500">-</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="时长" width="90" align="right">
            <template #default="{ row }">
              <span
                class="gm-num text-xs"
                :class="row.state === 'running' ? '' : 'text-g-500'"
                :title="row.state === 'running' ? '本次运行时长' : '停止容器：创建至今（无停止时间戳，作停龄上界）'"
              >{{ row.state === 'running' ? ageOf(row) : '停 ' + ageOf(row) }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn v-if="focusedNode" label="镜像" min-width="160" show-overflow-tooltip>
            <template #default="{ row }"><span class="gm-num text-xs">{{ row.image }}</span></template>
          </ElTableColumn>
          <ElTableColumn v-if="focusedNode" label="创建" width="170">
            <template #default="{ row }"><span class="gm-num text-xs whitespace-nowrap">{{ fmtDateTime(row.created) }}</span></template>
          </ElTableColumn>
          <ElTableColumn v-if="focusedNode" label="重启策略" width="90">
            <template #default="{ row }">
              <ElTag v-if="row.restart && row.restart !== 'no'" size="small" type="warning">{{ row.restart }}</ElTag>
              <span v-else class="text-xs text-g-500">-</span>
            </template>
          </ElTableColumn>
          <ElTableColumn v-if="focusedNode" label="体积" width="170" show-overflow-tooltip>
            <template #default="{ row }"><span class="gm-num text-xs whitespace-nowrap">{{ row.size || '-' }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="70" fixed="right">
            <template #default="{ row }">
              <ElButton
                v-if="isStopped(row.state)"
                link
                type="danger"
                size="small"
                @click="rmOne(n.name, row.name)"
              >删除</ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
        <p v-else class="text-xs text-g-500">{{ filterUser || filterState ? '无匹配当前过滤条件的容器' : '无容器' }}</p>

        <!-- 全部节点模式下只预览一部分，看全量请聚焦 -->
        <div v-if="!focusedNode && filtered(n).length > PREVIEW_N" class="text-center mt-3">
          <ElButton link type="primary" size="small" @click="focusNode(n.name)">
            查看 {{ n.name }} 全部 {{ filtered(n).length }} 个容器 →
          </ElButton>
        </div>
      </div>
    </template>
    <ElSkeleton v-else :rows="8" animated class="art-card p-5" />
  </div>
</template>

<script setup lang="ts">
  import { apiGet, apiPost } from '@/gpumon/api'
  import {
    fmtB,
    fmtDur,
    fmtDateTime,
    userColor,
    utilColor,
    loadTextColor,
    chartAxisStyle,
    GM_MONO_FONT
  } from '@/gpumon/format'
  import { useStatusStore } from '@/gpumon/store'
  import GmChart from '@/gpumon/components/GmChart.vue'
  import { useSettingStore } from '@/store/modules/setting'
  import type { DockerResp, DockerNode, DockerCont } from '@/gpumon/types'
  import type { EChartsOption } from '@/plugins/echarts'
  import { ElMessage, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'Docker' })

  const PREVIEW_N = 8

  const resp = ref<DockerResp | null>(null)
  const loading = ref(false)
  const filterUser = ref('')
  const filterState = ref<'' | 'running' | 'stopped' | 'abnormal'>('')
  const focusedNode = ref('')
  const route = useRoute()
  const router = useRouter()
  const store = useStatusStore()
  const settingStore = useSettingStore()

  async function load() {
    loading.value = true
    try {
      resp.value = await apiGet<DockerResp>('/api/docker')
    } catch (e) {
      ElMessage.error('获取失败：' + e)
    } finally {
      loading.value = false
    }
  }
  onMounted(() => {
    store.startPolling(10000) // GPU 占用徽标关联
    if (route.query.user) filterUser.value = String(route.query.user)
    const st = String(route.query.state ?? '')
    if (st === 'running' || st === 'stopped' || st === 'abnormal') filterState.value = st
    if (route.query.node) focusedNode.value = String(route.query.node)
    load()
  })

  function focusNode(name: string) {
    focusedNode.value = name
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isStopped = (s: string) => s === 'exited' || s === 'created' || s === 'dead'
  const stateOf = (s: string): 'running' | 'stopped' | 'abnormal' =>
    s === 'running' ? 'running' : isStopped(s) ? 'stopped' : 'abnormal'

  const shownNodes = computed(() => {
    const ns = [...(resp.value?.nodes ?? [])]
    if (resp.value?.control) ns.push({ ...resp.value.control, name: resp.value.control.name || '控制节点' })
    return ns
  })

  const visibleNodes = computed(() =>
    focusedNode.value ? shownNodes.value.filter((n) => n.name === focusedNode.value) : shownNodes.value
  )

  const allUsers = computed(() => {
    const s = new Set<string>()
    for (const n of shownNodes.value) for (const c of n.containers ?? []) if (c.user) s.add(c.user)
    return [...s].sort()
  })

  const filtered = (n: DockerNode) =>
    (n.containers ?? []).filter(
      (c) =>
        (!filterUser.value || c.user === filterUser.value) &&
        (!filterState.value || stateOf(c.state) === filterState.value)
    )

  // 预览排序：占 GPU 的运行 > 运行 > 异常 > 新近退出
  const rankOf = (n: DockerNode, c: DockerCont) => {
    const st = stateOf(c.state)
    if (st === 'running') return gpusOf(n.name, c.name).length ? 0 : 1
    if (st === 'abnormal') return 2
    return 3
  }
  const rowsOf = (n: DockerNode) => {
    const rows = [...filtered(n)].sort(
      (a, b) =>
        rankOf(n, a) - rankOf(n, b) ||
        new Date(b.created).getTime() - new Date(a.created).getTime()
    )
    return focusedNode.value ? rows : rows.slice(0, PREVIEW_N)
  }

  const stoppedCount = (n: DockerNode) =>
    (n.containers ?? []).filter(
      (c) => (!filterUser.value || c.user === filterUser.value) && isStopped(c.state)
    ).length

  // 运行中容器 ↔ GPU 占用
  const gpusOf = (node: string, container: string): number[] => {
    const n = (store.snap?.nodes ?? []).find((x) => x.name === node)
    if (!n) return []
    const s = new Set<number>()
    for (const p of n.procs ?? []) if (p.container === container) p.gpus.forEach((i) => s.add(i))
    return [...s].sort((a, b) => a - b)
  }

  const ageOf = (c: DockerCont) => {
    const from = c.state === 'running' && c.started && !c.started.startsWith('0001') ? c.started : c.created
    return fmtDur((Date.now() - new Date(from).getTime()) / 1000)
  }

  // ---- 总览统计 ----
  const allConts = computed(() =>
    shownNodes.value.flatMap((n) =>
      (n.containers ?? []).filter((c) => !filterUser.value || c.user === filterUser.value)
    )
  )

  const totals = computed(() => {
    let running = 0, stopped = 0, abnormal = 0
    for (const c of allConts.value) {
      const st = stateOf(c.state)
      if (st === 'running') running++
      else if (st === 'stopped') stopped++
      else abnormal++
    }
    return { running, stopped, abnormal, total: running + stopped + abnormal }
  })

  const statSum = computed(() => {
    let mem = 0, pids = 0, rw = 0
    for (const c of allConts.value) {
      if (c.state === 'running') {
        mem += c.mem_used_b ?? 0
        pids += c.pids ?? 0
      } else if (isStopped(c.state)) rw += c.size_rw_b ?? 0
    }
    return { mem, pids, rw }
  })

  const stateChips = computed(() => [
    { key: '' as const, label: '全部', count: totals.value.total, color: 'var(--gm-accent)' },
    { key: 'running' as const, label: '运行中', count: totals.value.running, color: 'var(--gm-ok)' },
    { key: 'stopped' as const, label: '已停止', count: totals.value.stopped, color: 'var(--art-gray-500, #909399)' },
    { key: 'abnormal' as const, label: '异常', count: totals.value.abnormal, color: 'var(--gm-hot)' }
  ])

  // ---- 图表 ----
  const ax = computed(() => chartAxisStyle(settingStore.isDark))
  const C = computed(() =>
    settingStore.isDark
      ? { ok: '#2dd4a7', gray: '#4b515c', err: '#f2655a', warn: '#f0b13c', brand: '#14c0b4', text: '#e3e5ea', exitOld: '#7d534d' }
      : { ok: '#2f9e6e', gray: '#c2c8d2', err: '#c94f3d', warn: '#d9962e', brand: '#0ea5a0', text: '#303133', exitOld: '#b97f74' }
  )

  const donutParts = computed(() => {
    let ok = 0, exit0 = 0, exitErr = 0, created = 0, other = 0
    for (const c of allConts.value) {
      if (c.state === 'running') ok++
      else if (c.state === 'exited' && c.exit_code === 0) exit0++
      else if (c.state === 'exited') exitErr++
      else if (c.state === 'created') created++
      else other++
    }
    // 陈年非零退出码不配告警红（历史事实≠当前故障）：用暗砖红；纯告警红只留给
    // dead/restarting 这类「现在就有问题」的状态，与顶部 chips 的「异常」口径一致
    return [
      { name: '运行中', value: ok, color: C.value.ok, key: 'running' },
      { name: '正常退出', value: exit0, color: C.value.gray, key: 'stopped' },
      { name: '非零退出', value: exitErr, color: C.value.exitOld, key: 'stopped' },
      { name: 'created', value: created, color: C.value.warn, key: 'stopped' },
      { name: '异常状态', value: other, color: C.value.err, key: 'abnormal' }
    ].filter((p) => p.value > 0)
  })

  const donutOption = computed<EChartsOption>(() => ({
    tooltip: {
      backgroundColor: ax.value.tooltipBg,
      borderWidth: 0,
      textStyle: { color: ax.value.tooltipText, fontSize: 12 }
    },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 'middle',
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: ax.value.label, fontSize: 11 }
    },
    title: {
      text: String(totals.value.total),
      subtext: '容器',
      left: '31%',
      top: '38%',
      textAlign: 'center',
      textStyle: { color: C.value.text, fontSize: 24, fontFamily: GM_MONO_FONT, fontWeight: 700 },
      subtextStyle: { color: ax.value.label, fontSize: 11 }
    },
    series: [
      {
        type: 'pie',
        radius: ['62%', '84%'],
        center: ['32%', '50%'],
        label: { show: false },
        itemStyle: { borderColor: ax.value.cardBg, borderWidth: 2 },
        emphasis: { scaleSize: 4 },
        data: donutParts.value.map((p) => ({ name: p.name, value: p.value, itemStyle: { color: p.color } }))
      }
    ]
  }))

  function onDonutPick(p: { name: string }) {
    const part = donutParts.value.find((x) => x.name === p.name)
    if (part) filterState.value = filterState.value === part.key ? '' : (part.key as typeof filterState.value)
  }

  const nodeBarOption = computed<EChartsOption>(() => {
    const nodes = shownNodes.value
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: ax.value.tooltipBg,
        borderWidth: 0,
        textStyle: { color: ax.value.tooltipText, fontSize: 12 }
      },
      legend: {
        top: 0,
        right: 0,
        icon: 'roundRect',
        itemWidth: 10,
        itemHeight: 8,
        textStyle: { color: ax.value.label, fontSize: 11 }
      },
      grid: { left: 4, right: 30, top: 22, bottom: 0, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { color: ax.value.label, fontSize: 10 },
        splitLine: { lineStyle: { color: ax.value.split } }
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: nodes.map((n) => n.name),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: ax.value.label, fontSize: 10, fontFamily: GM_MONO_FONT },
        triggerEvent: true
      },
      series: [
        {
          name: '运行中',
          type: 'bar',
          stack: 's',
          barMaxWidth: 12,
          itemStyle: { color: C.value.ok, borderRadius: [2, 0, 0, 2] },
          data: nodes.map((n) => n.running)
        },
        {
          name: '已停止',
          type: 'bar',
          stack: 's',
          barMaxWidth: 12,
          itemStyle: { color: C.value.gray, borderRadius: [0, 2, 2, 0] },
          data: nodes.map((n) => Math.max(0, n.total - n.running))
        }
      ]
    }
  })

  const imageBarOption = computed<EChartsOption>(() => {
    const cnt = new Map<string, number>()
    for (const c of allConts.value) {
      const img = (c.image || '未知').split('@')[0]
      cnt.set(img, (cnt.get(img) ?? 0) + 1)
    }
    const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    return {
      tooltip: {
        backgroundColor: ax.value.tooltipBg,
        borderWidth: 0,
        textStyle: { color: ax.value.tooltipText, fontSize: 12 }
      },
      grid: { left: 4, right: 34, top: 4, bottom: 0, containLabel: true },
      xAxis: { type: 'value', axisLabel: { show: false }, splitLine: { show: false } },
      yAxis: {
        type: 'category',
        inverse: true,
        data: top.map(([k]) => (k.length > 22 ? k.slice(0, 21) + '…' : k)),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: ax.value.label, fontSize: 10, fontFamily: GM_MONO_FONT }
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 12,
          itemStyle: { color: C.value.brand, opacity: 0.75, borderRadius: [0, 3, 3, 0] },
          label: { show: true, position: 'right', color: ax.value.label, fontSize: 10, fontFamily: GM_MONO_FONT },
          data: top.map(([, v]) => v)
        }
      ]
    }
  })

  // ---- 操作 ----
  async function rmOne(node: string, name: string) {
    try {
      await ElMessageBox.confirm(`删除容器 ${name}@${node}？（节点上会先复核状态，仅删已停止的）`, '删除容器', {
        confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning'
      })
    } catch { return }
    try {
      const r = await apiPost<{ ok: boolean; output: string }>('/api/docker/rm', { node, name })
      r.ok ? ElMessage.success('已删除') : ElMessage.warning('未删除：' + r.output)
      load()
    } catch (e) {
      ElMessage.error('操作失败：' + e)
    }
  }

  async function prune(node: string) {
    const scope = filterUser.value ? `节点 ${node} 上归属 ${filterUser.value}` : `节点 ${node} 上全部用户`
    const nd = shownNodes.value.find((x) => x.name === node)
    const byUser = new Map<string, number>()
    for (const c of nd?.containers ?? [])
      if (isStopped(c.state) && (!filterUser.value || c.user === filterUser.value))
        byUser.set(c.user || '未归属', (byUser.get(c.user || '未归属') ?? 0) + 1)
    const detail = [...byUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([u, c]) => `${u}×${c}`)
      .join('，')
    try {
      await ElMessageBox.confirm(
        `批量清理 ${scope} 的已停止容器？\n分布：${detail}${byUser.size > 6 ? ' …' : ''}`,
        '批量清理',
        { confirmButtonText: '清理', cancelButtonText: '取消', type: 'warning' }
      )
    } catch { return }
    try {
      const r = await apiPost<{ ok: boolean; removed: number; matched: number }>('/api/docker/prune', {
        node, user: filterUser.value || ''
      })
      ElMessage.success(`匹配 ${r.matched} 个，删除 ${r.removed} 个`)
      load()
    } catch (e) {
      ElMessage.error('操作失败：' + e)
    }
  }
</script>

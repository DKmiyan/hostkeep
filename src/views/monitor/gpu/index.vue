<!-- GPU：每节点的卡级明细 + GPU 进程；支持 ?node=&gpu= 深链定位（热度墙/节点表跳转来源） -->
<template>
  <div>
    <template v-if="snap">
      <!-- 节点快捷条：点击锚定；点=平均利用率档位色，「N 空」=空闲卡数 -->
      <div class="gm-nodenav">
        <span
          v-for="n in store.allocNodes"
          :key="n.name"
          class="nn"
          role="link"
          tabindex="0"
          :style="{ '--dc': n.online ? loadColor(nodeStats(n).avg) : 'var(--gm-hot)' }"
          @click="jumpTo(n.name)"
          @keydown.enter="jumpTo(n.name)"
        >
          <i class="dot" />{{ n.name }}
          <span v-if="n.online && nodeStats(n).total - nodeStats(n).used > 0" class="free">{{ nodeStats(n).total - nodeStats(n).used }} 空</span>
          <span v-else-if="!n.online" style="color: var(--gm-hot)">离线</span>
        </span>
      </div>

      <div
        v-for="n in store.allocNodes"
        :key="n.name"
        :id="`node-${n.name}`"
        class="art-card p-5 mb-5 max-sm:mb-4"
      >
        <div class="flex-b mb-4 flex-wrap gap-2">
          <h3 class="text-base font-medium flex items-center flex-wrap gap-y-1">
            <span class="gm-num">{{ n.name }}</span>
            <span class="gm-tag ml-2" :class="n.type === 'A100' ? 'a100' : 'l40s'">{{ n.type }}</span>
            <template v-if="n.online">
              <span class="ml-3 text-sm gm-num font-semibold" :style="{ color: loadTextColor(nodeStats(n).avg) }">
                均 {{ nodeStats(n).avg }}%
              </span>
              <span class="ml-3 text-xs font-normal text-g-500 gm-num">{{ nodeStats(n).used }}/{{ nodeStats(n).total }} 在用</span>
              <span class="ml-3 inline-flex items-center gap-2 text-xs font-normal text-g-500">
                <span class="gm-bar" style="width: 90px; flex: none">
                  <i :style="{ width: nodeStats(n).memPct + '%', background: utilColor(nodeStats(n).memPct), '--g': utilColor(nodeStats(n).memPct) }" />
                </span>
                <span class="gm-num">显存 {{ fmtG(nodeStats(n).memUsed) }}/{{ fmtG(nodeStats(n).memTotal) }}</span>
              </span>
            </template>
            <span v-else class="ml-2 text-sm" style="color: var(--gm-hot)">离线{{ n.error ? ' · ' + n.error : '' }}</span>
          </h3>
          <span class="text-xs text-g-500 gm-num" v-if="n.online">
            负载 {{ n.load1.toFixed(1) }} · CPU {{ n.cpu_pct.toFixed(0) }}% · 采集 {{ n.collect_ms }}ms
          </span>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-4" v-if="n.online">
          <div
            v-for="g in n.gpus"
            :key="g.index"
            :id="`gpu-${n.name}-${g.index}`"
            class="rounded-lg border border-[var(--art-border-color,#e4e7ed)] p-3"
            :class="{ 'gm-flash': flashKey === `${n.name}-${g.index}` }"
          >
            <div class="flex-b">
              <span class="text-xs text-g-500 gm-num">GPU{{ g.index }}</span>
              <span class="gm-num text-sm font-semibold" :style="{ color: g.util > 0 ? loadTextColor(g.util) : undefined }">
                {{ g.util }}%
              </span>
            </div>
            <div class="gm-bar mt-2">
              <i :style="{ width: memPct(g) + '%', background: loadColor(g.util), '--g': loadColor(g.util) }" />
            </div>
            <div class="mt-1 text-xs text-g-600 gm-num">{{ fmtG(g.mem_used) }}/{{ fmtG(g.mem_total) }}</div>
            <div class="mt-1 text-xs text-g-600 gm-num">{{ g.temp }}°C · {{ g.power_draw.toFixed(0) }}W</div>
            <div class="mt-1 h-5">
              <span v-for="u in gpuOwners(n, g.index)" :key="u" class="uchip mr-1" :style="{ '--c': userColor(u) }">{{ u }}</span>
            </div>
          </div>
        </div>

        <ElTable v-if="n.procs?.length" :data="n.procs" size="small">
          <ElTableColumn label="用户" width="110">
            <template #default="{ row }">
              <span
                class="uchip cursor-pointer"
                :style="{ '--c': userColor(row.user) }"
                title="查看该用户用量"
                @click="router.push({ path: '/users', query: { user: row.user } })"
              >{{ row.user }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="GPU" width="110">
            <template #default="{ row }"><span class="gm-num">{{ row.gpus.join(',') }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="显存" width="90" align="right">
            <template #default="{ row }"><span class="gm-num">{{ fmtG(row.gpu_mem_mb) }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="容器" min-width="240" show-overflow-tooltip>
            <template #default="{ row }">
              <span
                v-if="row.container"
                class="gm-num text-xs cursor-pointer text-theme"
                title="去容器页查看该节点容器"
                @click="router.push({ path: '/docker', query: { node: n.name } })"
              >{{ row.container }}</span>
              <span v-else class="gm-num text-xs">-</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="启动" width="170">
            <template #default="{ row }"><span class="gm-num text-xs">{{ fmtDateTime(row.start) }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="渠道" width="100">
            <template #default="{ row }">
              <ElTag v-if="row.launch" size="small" type="info">{{ row.launch }}</ElTag>
              <span v-else>-</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="命令" show-overflow-tooltip>
            <template #default="{ row }"><span class="gm-num text-xs">{{ row.cmd }}</span></template>
          </ElTableColumn>
          <ElTableColumn prop="pid" label="PID" width="90" align="right">
            <template #default="{ row }"><span class="gm-num">{{ row.pid }}</span></template>
          </ElTableColumn>
        </ElTable>
        <p v-else-if="n.online" class="text-xs text-g-500">无 GPU 进程</p>
      </div>
    </template>
    <ElSkeleton v-else :rows="8" animated class="art-card p-5" />
  </div>
</template>

<script setup lang="ts">
  import { useStatusStore } from '@/gpumon/store'
  import { fmtG, fmtDateTime, loadColor, loadTextColor, utilColor, userColor } from '@/gpumon/format'
  import type { NodeStatus, GPU } from '@/gpumon/types'

  defineOptions({ name: 'Gpu' })

  const store = useStatusStore()
  const route = useRoute()
  const router = useRouter()
  onMounted(() => store.startPolling(10000))
  const snap = computed(() => store.snap)

  const jumpTo = (name: string) =>
    document.getElementById(`node-${name}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const memPct = (g: GPU) => (g.mem_total ? Math.min(100, (g.mem_used / g.mem_total) * 100) : 0)

  const gpuOwners = (n: NodeStatus, idx: number) => {
    const s = new Set<string>()
    for (const p of n.procs ?? []) if (p.gpus.includes(idx)) s.add(p.user)
    return [...s].slice(0, 2)
  }

  // 节点头部仪表：均利用率 / 在用卡 / 显存合计
  const nodeStats = (n: NodeStatus) => {
    const gs = n.gpus ?? []
    const used = new Set<number>()
    for (const p of n.procs ?? []) p.gpus.forEach((i) => used.add(i))
    const memUsed = gs.reduce((a, g) => a + g.mem_used, 0)
    const memTotal = gs.reduce((a, g) => a + g.mem_total, 0)
    return {
      avg: gs.length ? Math.round(gs.reduce((a, g) => a + g.util, 0) / gs.length) : 0,
      used: used.size,
      total: gs.length,
      memUsed,
      memTotal,
      memPct: memTotal ? Math.min(100, (memUsed / memTotal) * 100) : 0
    }
  }

  // ---- 深链定位：?node=AI-CSA01[&gpu=3] → 滚到该节点，卡格闪烁高亮 ----
  const flashKey = ref('')
  let flashTimer: ReturnType<typeof setTimeout> | 0 = 0

  function locate() {
    const node = String(route.query.node ?? '')
    if (!node) return
    const gpu = route.query.gpu != null ? String(route.query.gpu) : ''
    // 数据到位后再定位（快照可能还没回来）
    nextTick(() => {
      const target = gpu !== '' ? document.getElementById(`gpu-${node}-${gpu}`) : document.getElementById(`node-${node}`)
      if (!target) return
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (gpu !== '') {
        flashKey.value = `${node}-${gpu}`
        if (flashTimer) clearTimeout(flashTimer)
        flashTimer = setTimeout(() => (flashKey.value = ''), 2400)
      }
    })
  }

  const located = ref('')
  watch(
    () => [!!snap.value, route.query.node, route.query.gpu] as const,
    ([ready]) => {
      const key = `${route.query.node ?? ''}|${route.query.gpu ?? ''}`
      if (!ready || !route.query.node || located.value === key) return
      located.value = key
      locate()
    },
    { immediate: true }
  )
  onUnmounted(() => {
    if (flashTimer) clearTimeout(flashTimer)
  })
</script>

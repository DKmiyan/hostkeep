<!-- CPU · 主机：节点资源明细（行点击→GPU 页）+ 控制节点横排状态 -->
<template>
  <div>
    <template v-if="snap">
      <div class="art-card p-5 mb-5 max-sm:mb-4">
        <h3 class="text-base font-medium mb-4">计算节点 <span class="ml-2 text-xs font-normal text-g-500">点击行查看该节点 GPU 明细</span></h3>
        <ElTable
          :data="rows"
          size="small"
          @row-click="(row: any) => router.push({ path: '/gpu', query: { node: row.name } })"
          :row-style="{ cursor: 'pointer' }"
        >
          <ElTableColumn prop="name" label="节点" width="110">
            <template #default="{ row }"><span class="gm-num font-semibold">{{ row.name }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="类型" width="75">
            <template #default="{ row }">
              <span class="gm-tag" :class="row.type === 'A100' ? 'a100' : 'l40s'">{{ row.type }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="CPU" width="170">
            <template #default="{ row }">
              <div class="gm-cellbar">
                <div class="gm-bar"><i :style="{ width: row.cpu + '%', background: loadColor(row.cpu), '--g': loadColor(row.cpu) }" /></div>
                <span class="gm-num">{{ row.cpu.toFixed(0) }}%</span>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="负载 1/5/15" width="160">
            <template #default="{ row }"><span class="gm-num text-xs whitespace-nowrap">{{ row.loads }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="内存" width="170">
            <template #default="{ row }">
              <div class="gm-cellbar">
                <div class="gm-bar"><i :style="{ width: row.memP + '%', background: utilColor(row.memP), '--g': utilColor(row.memP) }" /></div>
                <span class="gm-num">{{ row.memP.toFixed(0) }}%</span>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="内存已用" width="100" align="right">
            <template #default="{ row }">
              <span class="gm-num text-xs whitespace-nowrap" :title="`总量 ${row.memTotal}`">{{ row.memUsed }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="swap 已用" width="100" align="right">
            <template #default="{ row }">
              <span
                class="gm-num text-xs whitespace-nowrap"
                :style="row.swapWarn ? 'color: var(--gm-warn-text)' : ''"
                :title="row.swapWarn ? 'GPU 节点用到 swap 往往是内存吃紧的前兆' : ''"
              >{{ row.swap }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="根分区" width="170">
            <template #default="{ row }">
              <div class="gm-cellbar">
                <div class="gm-bar"><i :style="{ width: row.rootP + '%', background: utilColor(row.rootP), '--g': utilColor(row.rootP) }" /></div>
                <span class="gm-num">{{ row.rootP.toFixed(0) }}%</span>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn v-if="hasNet" label="网络 ↓/↑" width="140">
            <template #default="{ row }"><span class="gm-num text-xs whitespace-nowrap">{{ row.net }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="状态" width="70">
            <template #default="{ row }">
              <span :style="{ color: row.online ? 'var(--gm-ok-text)' : 'var(--gm-hot-text)' }">{{ row.online ? '在线' : '离线' }}</span>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <div class="art-card p-5 mb-5 max-sm:mb-4" v-if="snap.control">
        <h3 class="text-base font-medium mb-4">控制节点 <span class="ml-2 text-xs font-normal text-g-500 gm-num">{{ snap.control.hostname || '-' }}</span></h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div v-for="s in ctrlStats" :key="s.label" class="rounded-lg p-3" style="background: var(--gm-track)">
            <div class="text-xs text-g-600">{{ s.label }}</div>
            <div class="mt-1 gm-num text-lg font-semibold">{{ s.value }}</div>
            <div class="text-xs text-g-500 gm-num">{{ s.sub }}</div>
          </div>
        </div>
      </div>
    </template>
    <ElSkeleton v-else :rows="8" animated class="art-card p-5" />
  </div>
</template>

<script setup lang="ts">
  import { useStatusStore } from '@/gpumon/store'
  import { fmtG, utilColor, loadColor } from '@/gpumon/format'

  defineOptions({ name: 'Host' })

  const store = useStatusStore()
  const router = useRouter()
  onMounted(() => store.startPolling(10000))
  const snap = computed(() => store.snap)

  const rows = computed(() =>
    store.allocNodes.map((n) => ({
      name: n.name,
      type: n.type,
      online: n.online,
      cpu: n.cpu_pct,
      loads: `${n.load1.toFixed(1)} / ${n.load5.toFixed(1)} / ${n.load15.toFixed(1)}`,
      memP: n.mem_total_mb ? (n.mem_used_mb / n.mem_total_mb) * 100 : 0,
      memUsed: fmtG(n.mem_used_mb),
      memTotal: fmtG(n.mem_total_mb),
      swap: n.swap_total_mb ? fmtG(n.swap_used_mb) : '-',
      swapWarn: n.swap_used_mb > 1024, // >1G 提示
      rootP: n.root_total_mb ? (n.root_used_mb / n.root_total_mb) * 100 : 0,
      net: `${(n.net_rx_kbs / 1024).toFixed(1)} / ${(n.net_tx_kbs / 1024).toFixed(1)} MB/s`
    }))
  )

  // 网络采样全为 0 时整列隐藏（宁缺毋滥）
  const hasNet = computed(() =>
    store.allocNodes.some((n) => (n.net_rx_kbs ?? 0) > 0 || (n.net_tx_kbs ?? 0) > 0)
  )

  const ctrlStats = computed(() => {
    const ct = snap.value!.control!
    return [
      {
        label: 'CPU',
        value: `${(ct.cpu_pct ?? 0).toFixed(1)}%`,
        sub: `负载 ${ct.load1?.toFixed(1)} / ${ct.load5?.toFixed(1)} / ${ct.load15?.toFixed(1)}`
      },
      {
        label: '内存',
        value: fmtG(ct.mem_used_mb),
        sub: `共 ${fmtG(ct.mem_total_mb)}`
      },
      {
        label: '根分区',
        value: fmtG(ct.root_used_mb),
        sub: `共 ${fmtG(ct.root_total_mb)}`
      },
      {
        label: '角色',
        value: '控制节点',
        sub: '采集 / 面板 / LDAP'
      }
    ]
  })
</script>

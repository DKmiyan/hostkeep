<!-- 用户：卡时排行（今日/7天/30天）/ 今日用量（可展开进程明细）/ 限额行内编辑 / 熔断事件与管理操作分列
     支持 ?user= 深链定位展开 -->
<template>
  <div>
    <template v-if="snap">
      <div class="art-card p-5 mb-5 max-sm:mb-4">
        <div class="flex-b mb-3 flex-wrap gap-2">
          <h3 class="text-base font-medium">卡时排行</h3>
          <ElRadioGroup v-model="rankRange" size="small">
            <ElRadioButton value="today">今日</ElRadioButton>
            <ElRadioButton value="7d">近 7 天</ElRadioButton>
            <ElRadioButton value="30d">近 30 天</ElRadioButton>
          </ElRadioGroup>
        </div>
        <BarList :rows="rankRows" empty="该时间段暂无用量记录" @pick="(u) => locateUser(u)" />
        <p v-if="rankRange !== 'today'" class="mt-2 text-xs text-g-500">按天用量日志（午夜归档）+ 今日实时累计</p>
      </div>

      <div class="art-card p-5 mb-5 max-sm:mb-4">
        <div class="flex-b mb-4 flex-wrap gap-2">
          <h3 class="text-base font-medium">用户用量（今日实时累计，午夜归档）</h3>
          <span class="text-xs text-g-500">
            归因模式：<ElTag size="small" :type="attrMode === 'account' ? 'success' : 'info'">{{ attrMode === 'account' ? '账号直读' : '路径推断' }}</ElTag>
            <ElButton link type="primary" size="small" @click="toggleAttr">切换</ElButton>
          </span>
        </div>
        <ElTable
          :data="userRows"
          size="small"
          row-key="user"
          :expand-row-keys="expandedKeys"
          :row-class-name="rowClass"
          @expand-change="onExpandChange"
        >
          <ElTableColumn type="expand">
            <template #default="{ row }">
              <div class="px-6 py-2">
                <ElTable :data="row.procList" size="small">
                  <ElTableColumn label="节点" width="110">
                    <template #default="{ row: p }"><span class="gm-num">{{ p.node }}</span></template>
                  </ElTableColumn>
                  <ElTableColumn prop="pid" label="PID" width="90">
                    <template #default="{ row: p }"><span class="gm-num">{{ p.pid }}</span></template>
                  </ElTableColumn>
                  <ElTableColumn label="GPU" width="100">
                    <template #default="{ row: p }"><span class="gm-num">{{ p.gpus.join(',') }}</span></template>
                  </ElTableColumn>
                  <ElTableColumn label="显存" width="90" align="right">
                    <template #default="{ row: p }"><span class="gm-num">{{ fmtG(p.gpu_mem_mb) }}</span></template>
                  </ElTableColumn>
                  <ElTableColumn label="容器" width="150" show-overflow-tooltip>
                    <template #default="{ row: p }"><span class="gm-num text-xs">{{ p.container || '-' }}</span></template>
                  </ElTableColumn>
                  <ElTableColumn label="启动" width="170">
                    <template #default="{ row: p }"><span class="gm-num text-xs">{{ fmtDateTime(p.start) }}</span></template>
                  </ElTableColumn>
                  <ElTableColumn label="命令" show-overflow-tooltip>
                    <template #default="{ row: p }"><span class="gm-num text-xs">{{ p.cmd }}</span></template>
                  </ElTableColumn>
                </ElTable>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="用户" width="130">
            <template #default="{ row }"><span class="uchip" :style="{ '--c': userColor(row.user) }">{{ row.user }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="今日卡时" width="180" sortable prop="hours">
            <template #default="{ row }">
              <div class="gm-cellbar">
                <div class="gm-bar">
                  <i :style="{ width: hoursPct(row.hours) + '%', background: userColor(row.user), '--g': userColor(row.user) }" />
                </div>
                <span class="gm-num font-semibold" style="width: 48px">{{ row.hours.toFixed(1) }}</span>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="当前卡数" width="100" sortable prop="cur" align="right">
            <template #default="{ row }"><span class="gm-num">{{ row.cur }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="今日峰值" width="100" align="right">
            <template #default="{ row }"><span class="gm-num">{{ row.max }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="当前显存" width="100" align="right">
            <template #default="{ row }"><span class="gm-num">{{ fmtG(row.mem) }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="进程" width="70" align="right">
            <template #default="{ row }"><span class="gm-num">{{ row.procs }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="限额" width="170">
            <template #default="{ row }">
              <template v-if="row.limit">
                <span class="gm-num" :style="row.cur > row.limit.max_gpus ? 'color: var(--gm-hot); font-weight: 600' : ''">
                  {{ row.cur }}/{{ row.limit.max_gpus }} 卡
                </span>
                <ElTag size="small" :type="row.limit.enforce ? 'danger' : 'info'" class="ml-1">
                  {{ row.limit.enforce ? '强制' : '干跑' }}
                </ElTag>
              </template>
              <span v-else class="text-g-500 text-xs">-</span>
              <ElButton link type="primary" size="small" class="ml-1" @click="openLimit(row)">设限额</ElButton>
            </template>
          </ElTableColumn>
          <ElTableColumn label="占用节点">
            <template #default="{ row }">
              <ElTag
                v-for="nd in row.nodeAgg"
                :key="nd.node"
                size="small"
                class="mr-1 gm-num cursor-pointer"
                type="info"
                :title="nd.list.join(' ')"
                @click="router.push({ path: '/gpu', query: { node: nd.node } })"
              >{{ nd.node }} ×{{ nd.count }}</ElTag>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <ElRow :gutter="20" class="flex flex-wrap">
        <ElCol :sm="24" :lg="14" class="flex mb-5 max-sm:mb-4">
          <div class="art-card p-5 w-full">
            <h3 class="text-base font-medium mb-4">限额熔断事件</h3>
            <ElTable v-if="enforceEvents.length" :data="enforceEvents" size="small">
              <ElTableColumn label="时间" width="160">
                <template #default="{ row }"><span class="gm-num text-xs">{{ fmtDateTime(row.ts) }}</span></template>
              </ElTableColumn>
              <ElTableColumn label="用户" width="120">
                <template #default="{ row }"><span class="uchip" :style="{ '--c': userColor(row.user) }">{{ row.user }}</span></template>
              </ElTableColumn>
              <ElTableColumn label="占用/限额" width="100" align="right">
                <template #default="{ row }"><span class="gm-num">{{ row.using }} / {{ row.limit }}</span></template>
              </ElTableColumn>
              <ElTableColumn label="处置" width="90">
                <template #default="{ row }">
                  <ElTag size="small" :type="row.dry_run ? 'warning' : 'danger'">{{ row.dry_run ? '干跑' : '已熔断' }}</ElTag>
                </template>
              </ElTableColumn>
              <ElTableColumn label="动作">
                <template #default="{ row }">
                  <span class="text-xs gm-clamp2" :title="(row.actions || []).join('；')">{{ (row.actions || []).join('；') }}</span>
                </template>
              </ElTableColumn>
            </ElTable>
            <p v-else class="text-xs text-g-500">暂无熔断事件</p>
          </div>
        </ElCol>
        <ElCol :sm="24" :lg="10" class="flex mb-5 max-sm:mb-4">
          <div class="art-card p-5 w-full">
            <h3 class="text-base font-medium mb-4">管理操作记录 <span class="ml-1 text-xs font-normal text-g-500">建号 / 授权下发 / 容器清理</span></h3>
            <ElTable v-if="adminEvents.length" :data="adminEvents" size="small">
              <ElTableColumn label="时间" width="160">
                <template #default="{ row }"><span class="gm-num text-xs">{{ fmtDateTime(row.ts) }}</span></template>
              </ElTableColumn>
              <ElTableColumn label="类别" width="90">
                <template #default="{ row }">
                  <ElTag size="small" type="info">{{ row.user.replace('admin-', '') }}</ElTag>
                </template>
              </ElTableColumn>
              <ElTableColumn label="内容">
                <template #default="{ row }">
                  <span class="text-xs gm-clamp2" :title="(row.actions || []).join('；')">{{ (row.actions || []).join('；') }}</span>
                </template>
              </ElTableColumn>
            </ElTable>
            <p v-else class="text-xs text-g-500">暂无操作记录</p>
          </div>
        </ElCol>
      </ElRow>

      <!-- 限额编辑：热改 limits.json，enforce=true 需强确认 -->
      <ElDialog v-model="dlgShow" :title="`设置限额 · ${dlgUser}`" width="420px">
        <ElForm label-width="90px">
          <ElFormItem label="最大卡数">
            <ElInputNumber v-model="dlgMax" :min="0" :max="72" />
          </ElFormItem>
          <ElFormItem label="超限处置">
            <ElRadioGroup v-model="dlgEnforce">
              <ElRadio :value="false">干跑（只记录）</ElRadio>
              <ElRadio :value="true">强制（终止超限任务）</ElRadio>
            </ElRadioGroup>
          </ElFormItem>
          <p class="text-xs text-g-500 ml-1">
            按跨节点并发卡数判定，下一轮采集（≤15s）生效；root/ops/ai/user01 等账号内置白名单不受限。
          </p>
        </ElForm>
        <template #footer>
          <ElButton v-if="dlgHasLimit" type="danger" plain @click="removeLimit">删除限额</ElButton>
          <ElButton @click="dlgShow = false">取消</ElButton>
          <ElButton type="primary" @click="saveLimit">保存</ElButton>
        </template>
      </ElDialog>
    </template>
    <ElSkeleton v-else :rows="8" animated class="art-card p-5" />
  </div>
</template>

<script setup lang="ts">
  import { useStatusStore } from '@/gpumon/store'
  import { apiGet, apiPost } from '@/gpumon/api'
  import { fmtG, fmtDateTime, userColor } from '@/gpumon/format'
  import BarList, { type BarRow } from '@/gpumon/components/BarList.vue'
  import type { UsageResp } from '@/gpumon/types'
  import { ElMessage, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'Users' })

  const store = useStatusStore()
  const route = useRoute()
  const router = useRouter()
  onMounted(() => store.startPolling(10000))
  const snap = computed(() => store.snap)

  // 归因模式就地切换（与概览页同一套逻辑：确认 → POST → 下一轮 poll 生效）
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

  const userRows = computed(() =>
    [...(snap.value?.users ?? [])]
      .sort((a, b) => (b.gpu_hours_today || 0) - (a.gpu_hours_today || 0))
      .map((u) => {
        // "AI-CSA01:3" 形式聚合为 节点×卡数
        const byNode = new Map<string, string[]>()
        for (const g of u.gpus) {
          const i = g.lastIndexOf(':')
          const node = i > 0 ? g.slice(0, i) : g
          if (!byNode.has(node)) byNode.set(node, [])
          byNode.get(node)!.push(g)
        }
        return {
          user: u.user,
          hours: u.gpu_hours_today || 0,
          cur: u.gpus.length,
          max: u.max_gpus_today || 0,
          mem: u.gpu_mem_mb,
          procs: u.procs,
          nodeAgg: [...byNode.entries()].map(([node, list]) => ({ node, count: list.length, list })),
          limit: snap.value?.limits?.[u.user],
          procList: (snap.value?.nodes ?? []).flatMap((n) =>
            (n.procs ?? []).filter((p) => p.user === u.user).map((p) => ({ ...p, node: n.name }))
          )
        }
      })
  )

  const maxHours = computed(() => Math.max(0.1, ...userRows.value.map((r) => r.hours)))
  const hoursPct = (h: number) => (h / maxHours.value) * 100

  // ---- 卡时排行（今日实时 / 近 7 天 / 近 30 天，历史来自按天用量日志） ----
  // 默认近 7 天：今日数值下方用量表已有，排行面板的价值在历史视角
  const rankRange = ref<'today' | '7d' | '30d'>('7d')
  const usage = ref<UsageResp | null>(null)
  onMounted(async () => {
    try {
      usage.value = await apiGet<UsageResp>('/api/usage')
    } catch {
      /* 静默：排行回退为仅今日 */
    }
  })

  const rankRows = computed<BarRow[]>(() => {
    const acc = new Map<string, number>()
    if (rankRange.value !== 'today' && usage.value?.history) {
      const days = rankRange.value === '7d' ? 7 : 30
      const cut = new Date(Date.now() - days * 86400e3).toISOString().slice(0, 10)
      for (const d of usage.value.history) {
        if (d.date < cut) continue
        for (const [name, u] of Object.entries(d.users ?? {}))
          acc.set(name, (acc.get(name) ?? 0) + (u.gpu_hours || 0))
      }
    }
    for (const u of snap.value?.users ?? [])
      acc.set(u.user, (acc.get(u.user) ?? 0) + (u.gpu_hours_today || 0))
    const rows = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    const max = Math.max(0.1, ...rows.map(([, h]) => h))
    return rows
      .filter(([, h]) => h > 0)
      .map(([name, h]) => ({
        label: name,
        pct: (h / max) * 100,
        value: h.toFixed(1),
        color: userColor(name)
      }))
  })

  // ---- 熔断事件 vs 管理操作（admin-* 是账号/容器管理日志，不是熔断） ----
  const allEvents = computed(() => [...(snap.value?.enforce_events ?? [])].reverse())
  const enforceEvents = computed(() => allEvents.value.filter((e) => !e.user.startsWith('admin-')))
  const adminEvents = computed(() => allEvents.value.filter((e) => e.user.startsWith('admin-')))

  // ---- 限额行内编辑：GET 全量配置改一项再 POST 回 ----
  const dlgShow = ref(false)
  const dlgUser = ref('')
  const dlgMax = ref(8)
  const dlgEnforce = ref(false)
  const dlgHasLimit = ref(false)

  function openLimit(row: { user: string; limit?: { max_gpus: number; enforce: boolean } }) {
    dlgUser.value = row.user
    dlgMax.value = row.limit?.max_gpus ?? 8
    dlgEnforce.value = row.limit?.enforce ?? false
    dlgHasLimit.value = !!row.limit
    dlgShow.value = true
  }

  async function fetchLimitsConf() {
    const r = await apiGet<{ limits: { grace_sec: number; users: Record<string, { max_gpus: number; enforce: boolean }> } | null }>('/api/limits')
    return r.limits ?? { grace_sec: 60, users: {} }
  }

  async function saveLimit() {
    if (dlgEnforce.value) {
      try {
        await ElMessageBox.confirm(
          `强制模式下，${dlgUser.value} 超过 ${dlgMax.value} 卡的进程会被自动终止（容器 stop / 进程 TERM→KILL）。确定？`,
          '启用强制熔断',
          { confirmButtonText: '确定启用', cancelButtonText: '取消', type: 'warning' }
        )
      } catch {
        return
      }
    }
    try {
      const conf = await fetchLimitsConf()
      conf.users = { ...conf.users, [dlgUser.value]: { max_gpus: dlgMax.value, enforce: dlgEnforce.value } }
      await apiPost('/api/limits', conf)
      ElMessage.success(`已设置 ${dlgUser.value} 限额 ${dlgMax.value} 卡（${dlgEnforce.value ? '强制' : '干跑'}）`)
      dlgShow.value = false
      store.refresh()
    } catch (e) {
      ElMessage.error('保存失败：' + e)
    }
  }

  async function removeLimit() {
    try {
      const conf = await fetchLimitsConf()
      delete conf.users[dlgUser.value]
      await apiPost('/api/limits', conf)
      ElMessage.success(`已删除 ${dlgUser.value} 的限额`)
      dlgShow.value = false
      store.refresh()
    } catch (e) {
      ElMessage.error('删除失败：' + e)
    }
  }

  // ---- 深链：?user=xxx → 展开该用户并高亮（声明式 expand-row-keys） ----
  const expandedKeys = ref<string[]>([])
  const flashUser = ref('')
  const located = ref('')
  const rowClass = ({ row }: { row: { user: string } }) =>
    row.user === flashUser.value ? 'gm-flash' : ''

  function onExpandChange(row: { user: string }, expanded: { user: string }[]) {
    expandedKeys.value = expanded.map((r) => r.user)
  }

  function locateUser(target: string) {
    if (!userRows.value.some((r) => r.user === target)) {
      ElMessage.info(`${target} 当前没有在跑的 GPU 任务`)
      return
    }
    if (!expandedKeys.value.includes(target)) expandedKeys.value = [...expandedKeys.value, target]
    flashUser.value = target
    setTimeout(() => (flashUser.value = ''), 2400)
  }

  watch(
    () => [userRows.value.length > 0, route.query.user] as const,
    ([ready]) => {
      const target = String(route.query.user ?? '')
      if (!ready || !target || located.value === target) return
      if (!userRows.value.some((r) => r.user === target)) return
      located.value = target
      if (!expandedKeys.value.includes(target)) expandedKeys.value = [...expandedKeys.value, target]
      flashUser.value = target
      setTimeout(() => (flashUser.value = ''), 2400)
    },
    { immediate: true }
  )
</script>

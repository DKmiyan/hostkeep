<!-- 审计：登录记录按人聚合 / GPU 进程启动溯源 / 定时任务清单 -->
<template>
  <div>
    <template v-if="resp">
      <div class="art-card p-5 mb-5 max-sm:mb-4">
        <div class="flex-b mb-4">
          <h3 class="text-base font-medium">登录概况（按人聚合，全节点）</h3>
          <ElButton size="small" @click="load" :loading="loading">刷新</ElButton>
        </div>
        <ElTable :data="userAgg" size="small">
          <ElTableColumn label="用户" width="130">
            <template #default="{ row }">
              <span
                class="uchip cursor-pointer"
                :style="{ '--c': userColor(row.user) }"
                title="查看该用户用量"
                @click="router.push({ path: '/users', query: { user: row.user } })"
              >{{ row.user }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="当前在线会话" width="120" sortable prop="online">
            <template #default="{ row }">
              <span class="gm-num" :style="{ color: row.online > 0 ? 'var(--gm-ok)' : undefined }">{{ row.online }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="最后登录" width="170" sortable prop="lastTs">
            <template #default="{ row }"><span class="gm-num text-xs">{{ fmtDateTime(row.last) }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="最后登录节点" width="120">
            <template #default="{ row }">
              <span
                class="gm-num text-xs cursor-pointer text-theme"
                @click="router.push({ path: '/gpu', query: { node: row.lastNode } })"
              >{{ row.lastNode }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="来源 IP（近 5 个）">
            <template #default="{ row }">
              <ElTag v-for="ip in row.ips" :key="ip" size="small" type="info" class="mr-1 gm-num">{{ ip === '0.0.0.0' ? '本地' : ip }}</ElTag>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <div class="art-card p-5 mb-5 max-sm:mb-4">
        <div class="flex-b mb-4">
          <h3 class="text-base font-medium">定时任务清单</h3>
          <ElSelect v-model="cronNode" size="small" style="width: 160px">
            <ElOption v-for="n in resp.nodes" :key="n.name" :label="n.name" :value="n.name" />
          </ElSelect>
        </div>
        <ElTable v-if="cronRows.length" :data="cronRows" size="small" max-height="420">
          <ElTableColumn label="类型" width="88">
            <template #default="{ row }">
              <ElTag size="small" :type="row.kind === 'cron' ? 'warning' : row.kind === 'at' ? 'danger' : 'info'">
                {{ row.kind }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="来源 / 名称" width="220">
            <template #default="{ row }"><span class="gm-num text-xs">{{ row.src }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="调度 / 下次触发" width="180">
            <template #default="{ row }"><span class="gm-num text-xs">{{ row.sched || '-' }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="命令 / 服务" show-overflow-tooltip>
            <template #default="{ row }"><span class="gm-num text-xs">{{ row.cmd || '-' }}</span></template>
          </ElTableColumn>
        </ElTable>
        <p v-else class="text-xs text-g-500">该节点无定时任务记录</p>
      </div>

      <div class="art-card p-5 mb-5 max-sm:mb-4">
        <div class="flex-b mb-4 flex-wrap gap-2">
          <h3 class="text-base font-medium">GPU 进程启动溯源（当前快照）</h3>
          <div class="flex items-center gap-2">
            <span v-if="hideContainer && containerCount" class="text-xs text-g-500">
              已折叠 {{ containerCount }} 条 container 渠道（无启动链，GPU 页可见）
            </span>
            <ElRadioGroup v-model="traceFilter" size="small">
              <ElRadioButton value="rare">裸进程</ElRadioButton>
              <ElRadioButton value="all">全部</ElRadioButton>
            </ElRadioGroup>
          </div>
        </div>
        <ElTable :data="shownTrace" size="small">
          <ElTableColumn label="节点" width="110">
            <template #default="{ row }"><span class="gm-num">{{ row.node }}</span></template>
          </ElTableColumn>
          <ElTableColumn prop="pid" label="PID" width="90">
            <template #default="{ row }"><span class="gm-num">{{ row.pid }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="用户" width="110">
            <template #default="{ row }">
              <span
                class="uchip cursor-pointer"
                :style="{ '--c': userColor(row.user) }"
                @click="router.push({ path: '/users', query: { user: row.user } })"
              >{{ row.user }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="启动时间" width="170">
            <template #default="{ row }"><span class="gm-num text-xs">{{ fmtDateTime(row.start) }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="渠道" width="100">
            <template #default="{ row }">
              <ElTag size="small" :type="row.launch === 'cron' ? 'warning' : 'info'">{{ row.launch || '未知' }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="启动链" show-overflow-tooltip>
            <template #default="{ row }">
              <span
                class="gm-num text-xs"
                :class="row.chain ? 'cursor-pointer' : ''"
                :title="row.chain ? '点击复制完整启动链' : ''"
                @click="row.chain && copyChain(row.chain)"
              >{{ row.chain || '-' }}</span>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <div class="art-card p-5 mb-5 max-sm:mb-4">
        <div class="flex-b mb-4">
          <h3 class="text-base font-medium">登录明细</h3>
          <ElSelect v-model="loginNode" size="small" style="width: 160px">
            <ElOption v-for="n in resp.nodes" :key="n.name" :label="n.name" :value="n.name" />
          </ElSelect>
        </div>
        <ElTable :data="logins" size="small" max-height="480">
          <ElTableColumn label="用户" width="120">
            <template #default="{ row }"><span class="uchip" :style="{ '--c': userColor(row.user) }">{{ row.user }}</span></template>
          </ElTableColumn>
          <ElTableColumn prop="tty" label="TTY" width="100">
            <template #default="{ row }"><span class="gm-num text-xs">{{ row.tty }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="来源 IP" width="150">
            <template #default="{ row }">
              <span class="gm-num text-xs">{{ row.ip === '0.0.0.0' ? '本地' : row.ip || '-' }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="登录" width="170">
            <template #default="{ row }"><span class="gm-num text-xs">{{ fmtDateTime(row.login) }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="登出" width="170">
            <template #default="{ row }">
              <span v-if="row.online" style="color: var(--gm-ok)">在线</span>
              <span v-else class="gm-num text-xs">{{ fmtDateTime(row.logout) }}</span>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </template>
    <ElSkeleton v-else :rows="8" animated class="art-card p-5" />
  </div>
</template>

<script setup lang="ts">
  import { apiGet } from '@/gpumon/api'
  import { useStatusStore } from '@/gpumon/store'
  import { fmtDateTime, userColor } from '@/gpumon/format'
  import type { AuditResp } from '@/gpumon/types'
  import { ElMessage } from 'element-plus'

  defineOptions({ name: 'Audit' })

  const store = useStatusStore()
  const router = useRouter()
  onMounted(() => store.startPolling(10000))

  const resp = ref<AuditResp | null>(null)
  const loading = ref(false)
  const cronNode = ref('')
  const loginNode = ref('')

  async function load() {
    loading.value = true
    try {
      resp.value = await apiGet<AuditResp>('/api/audit')
      if (!cronNode.value && resp.value.nodes.length) cronNode.value = resp.value.nodes[0].name
      if (!loginNode.value && resp.value.nodes.length) loginNode.value = resp.value.nodes[0].name
    } catch (e) {
      ElMessage.error('获取失败：' + e)
    } finally {
      loading.value = false
    }
  }
  onMounted(load)

  // 按人聚合：最后登录 + 在线会话数 + 常用来源
  const userAgg = computed(() => {
    const m = new Map<string, { user: string; online: number; last: string; lastTs: number; lastNode: string; ips: string[] }>()
    for (const n of resp.value?.nodes ?? []) {
      for (const l of n.logins) {
        let e = m.get(l.user)
        if (!e) {
          e = { user: l.user, online: 0, last: '', lastTs: 0, lastNode: '', ips: [] }
          m.set(l.user, e)
        }
        if (l.online) e.online++
        const ts = new Date(l.login).getTime()
        if (ts > e.lastTs) {
          e.lastTs = ts
          e.last = l.login
          e.lastNode = n.name
        }
        if (l.ip && !e.ips.includes(l.ip)) e.ips.push(l.ip)
      }
    }
    return [...m.values()]
      .map((e) => ({ ...e, ips: e.ips.slice(0, 5) }))
      .sort((a, b) => b.online - a.online || b.lastTs - a.lastTs)
  })

  // GPU 进程溯源（来自状态快照的 launch/chain）
  const procTrace = computed(() =>
    (store.snap?.nodes ?? []).flatMap((n) =>
      (n.procs ?? []).map((p) => ({ node: n.name, ...p }))
    )
  )

  // container 渠道是常态且无启动链，默认折叠——审计要盯的是 ssh/nohup/cron 裸进程
  const traceFilter = ref<'rare' | 'all'>('rare')
  const hideContainer = computed(() => traceFilter.value === 'rare')
  const containerCount = computed(() => procTrace.value.filter((p) => p.launch === 'container').length)
  const shownTrace = computed(() =>
    hideContainer.value ? procTrace.value.filter((p) => p.launch !== 'container') : procTrace.value
  )

  const crons = computed(
    () => resp.value?.nodes.find((n) => n.name === cronNode.value)?.crons ?? []
  )
  async function copyChain(chain: string) {
    try {
      await navigator.clipboard.writeText(chain)
      ElMessage.success('已复制启动链')
    } catch {
      ElMessage.warning('复制失败（浏览器限制）')
    }
  }

  // 行协议 `类型|来源|调度|命令`（timer 为 `timer|名称|下次|service`）解析成表格行
  const cronRows = computed(() =>
    crons.value.map((l) => {
      const p = l.split('|')
      // timer 的下次触发去掉英文星期前缀（如 "Tue 2026-08-18 06:21:00" → "2026-08-18 06:21:00"）
      const sched = (p[2] ?? '').replace(/^[A-Za-z]{3}\s+/, '')
      return { kind: p[0] ?? '', src: p[1] ?? '', sched, cmd: p.slice(3).join('|') }
    })
  )
  const logins = computed(
    () => resp.value?.nodes.find((n) => n.name === loginNode.value)?.logins ?? []
  )
</script>

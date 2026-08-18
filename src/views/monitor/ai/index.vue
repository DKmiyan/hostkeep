<!-- AI 驾驶舱：聊天式运维控制台。后端 /api/ai/chat SSE 流式；
     工具结果以表格/图表卡片内嵌对话；写操作走审批卡确认。 -->
<template>
  <div class="ai-page">
    <!-- 左栏：常用技能 + 会话控制 -->
    <div class="side art-card">
      <div class="side-head">
        <span>常用技能</span>
        <ElButton text size="small" @click="openSkillDialog()">
          <i class="iconfont-sys">＋</i>&nbsp;新增
        </ElButton>
      </div>
      <div class="skill-list">
        <div v-for="(s, i) in skills" :key="i" class="skill" @click="useSkill(s)">
          <span class="nm">{{ s.name }}</span>
          <span class="ops" @click.stop>
            <ElIcon class="op" title="编辑" @click="openSkillDialog(i)"><EditPen /></ElIcon>
            <ElIcon class="op del" title="删除" @click="removeSkill(i)"><Delete /></ElIcon>
          </span>
        </div>
      </div>
      <div class="side-foot">
        <ElSelect v-model="provider" size="small" class="w-full mb-2">
          <ElOption v-for="p in providers" :key="p.name" :value="p.name" :label="p.name">
            <span class="pdot" :class="{ ready: p.ready }"></span>
            {{ p.name }}
            <span class="pmodel">{{ p.model }}</span>
          </ElOption>
        </ElSelect>
        <ElButton size="small" class="w-full" :disabled="!msgs.length" @click="newChat">
          新对话
        </ElButton>
      </div>
    </div>

    <!-- 主区：对话 -->
    <div class="main art-card">
      <div class="chat-head">
        <span class="title">AI 驾驶舱</span>
        <ElTag v-if="activeModel" size="small" effect="plain" class="gm-num">{{ activeModel }}</ElTag>
        <ElTag v-if="sessionId" size="small" type="info" effect="plain" class="gm-num">
          会话 {{ sessionId.slice(0, 6) }}
        </ElTag>
        <span class="flex-1"></span>
        <span v-if="liveLine" class="live gm-num">{{ liveLine }}</span>
        <span v-if="!providerReady" class="warn-key">
          该模型未配置 API Key（服务端 ai.json）· mock 演示可用
        </span>
      </div>

      <div ref="scrollEl" class="chat-body" @click="onBodyClick" @scroll="onScroll">
        <!-- 空态 -->
        <div v-if="!msgs.length" class="hero">
          <div class="orb"></div>
          <div class="h1">有什么要查的、要办的？</div>
          <div class="h2">用一句话调动整套监控：查用量、看趋势、审登录、清容器、设限额</div>
          <div class="chips">
            <span v-for="(q, i) in EXAMPLES" :key="i" class="chip" @click="useExample(q)">
              {{ q }}
            </span>
          </div>
        </div>

        <!-- 消息流 -->
        <template v-for="m in msgs" :key="m.id">
          <div v-if="m.role === 'user'" class="msg-user">
            <div class="bubble">{{ m.text }}</div>
          </div>

          <div v-else-if="m.role === 'assistant'" class="msg-ai">
            <div class="md-body" v-html="renderMarkdown(m.text ?? '')"></div>
            <span v-if="m.streaming" class="cursor">▍</span>
            <ElIcon
              v-if="!m.streaming && m.text"
              class="copy"
              title="复制原文"
              @click="copyText(m.text!)"
            >
              <CopyDocument />
            </ElIcon>
          </div>

          <div v-else-if="m.role === 'error'" class="msg-err">
            ⚠ {{ m.text }}
            <ElButton
              v-if="lastUserText && !sending"
              size="small"
              text
              type="primary"
              @click="retryLast"
            >
              重试
            </ElButton>
          </div>

          <div v-else-if="m.role === 'tool'" class="msg-tool" :class="{ err: m.status === 'err' }">
            <div class="tool-head">
              <ElIcon v-if="m.status === 'run'" class="spin"><Loading /></ElIcon>
              <ElIcon v-else-if="m.status === 'ok'" class="okc"><CircleCheck /></ElIcon>
              <ElIcon v-else class="errc"><CircleClose /></ElIcon>
              <span class="lbl">{{ m.label || m.name }}</span>
              <span v-if="m.error" class="etxt">{{ m.error }}</span>
            </div>
            <ToolCardComp v-if="m.ui" :ui="m.ui" class="tool-body" />
          </div>

          <div v-else-if="m.role === 'approval'" class="msg-approval" :class="{ danger: m.danger }">
            <div class="ap-head">
              <ElIcon><WarningFilled /></ElIcon>
              <span>{{ m.danger ? '高危操作待确认' : '操作待确认' }}</span>
            </div>
            <div class="ap-label">{{ m.label }}</div>
            <div v-if="m.args && Object.keys(m.args).length" class="ap-args gm-num">
              <span v-for="(v, k) in m.args" :key="k">{{ k }}={{ v }}</span>
            </div>
            <ToolCardComp v-if="m.preview" :ui="m.preview" class="mt-3" />
            <div v-if="m.status === 'pending'" class="ap-btns">
              <ElButton size="small" @click="approve(m, false)">取消</ElButton>
              <ElButton size="small" :type="m.danger ? 'danger' : 'primary'" @click="approve(m, true)">
                确认执行
              </ElButton>
            </div>
            <div v-else class="ap-done">
              {{
                m.status === 'approved' ? '✓ 已确认执行'
                : m.status === 'skipped' ? '— 已跳过（发送了新消息）'
                : '✕ 已取消'
              }}
            </div>
          </div>
        </template>
      </div>

      <Transition name="el-fade-in">
        <ElButton v-show="showJump" circle class="jump-btn" @click="scrollBottom(true)">
          <ElIcon><ArrowDown /></ElIcon>
        </ElButton>
      </Transition>

      <div class="chat-input">
        <ElInput
          ref="inputRef"
          v-model="input"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 6 }"
          resize="none"
          placeholder="问点什么，或下个指令…（Enter 发送，Shift+Enter 换行）"
          :disabled="sending"
          @keydown.enter="onEnter"
        />
        <ElButton v-if="sending" type="danger" plain @click="stopStream">停止</ElButton>
        <ElButton v-else type="primary" :disabled="!input.trim()" @click="onSend">发送</ElButton>
      </div>
    </div>

    <!-- 技能编辑 -->
    <ElDialog v-model="skillDlg" :title="skillIdx < 0 ? '新增技能' : '编辑技能'" width="480px">
      <ElForm label-width="60px">
        <ElFormItem label="名称">
          <ElInput v-model="skillDraft.name" maxlength="12" placeholder="如：查某人用量" />
        </ElFormItem>
        <ElFormItem label="内容">
          <ElInput
            v-model="skillDraft.prompt"
            type="textarea"
            :rows="4"
            placeholder="点击技能时填入输入框的提问模板，需现场改的部分用 ___ 占位"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="skillDlg = false">取消</ElButton>
        <ElButton type="primary" @click="saveSkill">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    EditPen, Delete, Loading, CircleCheck, CircleClose, WarningFilled, ArrowDown, CopyDocument
  } from '@element-plus/icons-vue'
  import { renderMarkdown } from '@/gpumon/markdown'
  import { useUserStore } from '@/store/modules/user'
  import { useStatusStore } from '@/gpumon/store'
  import ToolCardComp from './ToolCard.vue'

  defineOptions({ name: 'AiConsole' })

  const router = useRouter()

  interface ChatMsg {
    id: number
    role: 'user' | 'assistant' | 'tool' | 'approval' | 'error'
    text?: string
    streaming?: boolean
    // tool
    tid?: string
    name?: string
    label?: string
    status?: string
    ui?: any
    error?: string
    // approval
    actionId?: string
    args?: Record<string, unknown>
    danger?: boolean
    preview?: any
  }

  // 空态示例问句（展示自然语言用法；左栏技能是可编辑的快捷模板，两者不重复）
  const EXAMPLES = [
    '帮我找 4 张空闲的卡',
    'szs 这周用了多少卡时？',
    '共享盘最近谁涨得最快？',
    '昨晚集群负载怎么样？',
    '有哪些停了很久的容器可以清理？',
    '最近有没有陌生 IP 登录过节点？'
  ]
  function useExample(q: string) {
    input.value = q
    if (!sending.value) onSend()
  }

  const msgs = ref<ChatMsg[]>([])
  const sessionId = ref('')
  const input = ref('')
  const sending = ref(false)
  const lastUserText = ref('')
  const inputRef = ref<{ focus: () => void }>()
  let nextId = 1
  let aborter: AbortController | null = null

  // 顶栏实时集群状态条（复用全站轮询）
  const statusStore = useStatusStore()
  onMounted(() => statusStore.startPolling(15000))
  const liveLine = computed(() => {
    const c = statusStore.snap?.cluster
    if (!c) return ''
    return `GPU ${c.gpu_in_use}/${c.gpu_alloc_total} · 均 ${c.gpu_util_avg}% · 节点 ${c.nodes_online}/${c.nodes_total} · 活跃 ${c.active_users} 人`
  })

  // 刷新恢复：会话与消息暂存 sessionStorage（后端会话内存保留 2h，续聊仍有效）
  const CONV_KEY = 'gm-ai-conv'
  function saveConv() {
    try {
      const data = JSON.stringify({ sessionId: sessionId.value, msgs: msgs.value, nextId })
      if (data.length < 2_000_000) sessionStorage.setItem(CONV_KEY, data)
    } catch {
      /* 超限就不存 */
    }
  }
  onMounted(() => {
    try {
      const raw = sessionStorage.getItem(CONV_KEY)
      if (raw) {
        const d = JSON.parse(raw)
        if (Array.isArray(d.msgs) && d.msgs.length) {
          for (const m of d.msgs) {
            if (m.role === 'assistant') m.streaming = false
            if (m.role === 'tool' && m.status === 'run') m.status = 'err'
            // 刷新前挂着的审批：后端会话可能已重启/过期，恢复后不再提供按钮
            if (m.role === 'approval' && m.status === 'pending') m.status = 'skipped'
          }
          msgs.value = d.msgs
          sessionId.value = d.sessionId ?? ''
          nextId = d.nextId ?? d.msgs.length + 1
          scrollBottom(true)
        }
      }
    } catch {
      /* 坏数据忽略 */
    }
  })

  // ---- provider ----
  const providers = ref<{ name: string; model: string; ready: boolean }[]>([])
  const provider = ref('')
  const providerReady = computed(
    () => providers.value.find((p) => p.name === provider.value)?.ready ?? false
  )
  const activeModel = computed(
    () => providers.value.find((p) => p.name === provider.value)?.model ?? ''
  )
  onMounted(async () => {
    try {
      const r = await fetch('/api/ai/config')
      if (r.ok) {
        const c = await r.json()
        providers.value = c.providers ?? []
        const def = providers.value.find((p) => p.name === c.default && p.ready)
        provider.value = def?.name ?? providers.value.find((p) => p.ready)?.name ?? 'mock'
      }
    } catch {
      providers.value = [{ name: 'mock', model: 'offline-demo', ready: true }]
      provider.value = 'mock'
    }
  })

  // ---- 滚动：贴底时才自动跟随，翻历史时出现回底按钮 ----
  const scrollEl = ref<HTMLDivElement>()
  const autoScroll = ref(true)
  const showJump = ref(false)
  function onScroll() {
    const el = scrollEl.value
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 90
    autoScroll.value = near
    showJump.value = !near && msgs.value.length > 0
  }
  function scrollBottom(force = false) {
    if (!force && !autoScroll.value) return
    nextTick(() => {
      const el = scrollEl.value
      if (el) el.scrollTop = el.scrollHeight
    })
    if (force) {
      autoScroll.value = true
      showJump.value = false
    }
  }

  // ---- SSE ----
  function push(m: Omit<ChatMsg, 'id'>): ChatMsg {
    msgs.value.push({ ...m, id: nextId++ } as ChatMsg)
    scrollBottom()
    // 返回数组里的 reactive proxy（返回原始对象会让 === 比较失效）
    return msgs.value[msgs.value.length - 1]
  }

  async function stream(body: Record<string, unknown>) {
    sending.value = true
    let cur: ChatMsg | null = null
    aborter = new AbortController()
    try {
      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: aborter.signal
      })
      if (resp.status === 401) {
        useUserStore().logOut()
        return
      }
      if (!resp.ok || !resp.body) {
        push({ role: 'error', text: await resp.text() })
        return
      }
      const reader = resp.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      const handle = (frame: string) => {
        let event = 'message'
        let data = ''
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          else if (line.startsWith('data:')) data += line.slice(5).trim()
        }
        let d: any = {}
        try {
          d = data ? JSON.parse(data) : {}
        } catch {
          return
        }
        switch (event) {
          case 'meta':
            sessionId.value = d.session
            break
          case 'delta': {
            const last = msgs.value[msgs.value.length - 1]
            if (cur && last === cur) cur.text = (cur.text ?? '') + d.t
            else cur = push({ role: 'assistant', text: d.t, streaming: true })
            scrollBottom()
            break
          }
          case 'tool_start':
            if (cur) cur.streaming = false
            cur = null
            push({ role: 'tool', tid: d.id, name: d.name, label: d.label, status: 'run' })
            break
          case 'tool_result': {
            const t = [...msgs.value].reverse().find((m) => m.role === 'tool' && m.tid === d.id)
            if (t) {
              t.status = d.ok ? 'ok' : 'err'
              t.ui = d.ui
              t.error = d.error
            }
            scrollBottom()
            break
          }
          case 'approval':
            if (cur) cur.streaming = false
            cur = null
            push({
              role: 'approval', actionId: d.action_id, label: d.label,
              args: d.args, danger: !!d.danger, preview: d.preview, status: 'pending'
            })
            break
          case 'error':
            if (cur) cur.streaming = false
            cur = null
            push({ role: 'error', text: d.msg })
            break
        }
      }
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let idx
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          handle(buf.slice(0, idx))
          buf = buf.slice(idx + 2)
        }
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') push({ role: 'error', text: String(e) })
    } finally {
      if (cur) cur.streaming = false
      sending.value = false
      aborter = null
      scrollBottom()
      saveConv()
      nextTick(() => inputRef.value?.focus())
    }
  }

  function stopStream() {
    aborter?.abort()
  }

  function onEnter(e: Event) {
    const ke = e as KeyboardEvent
    if (ke.isComposing || ke.shiftKey) return // 输入法组词中的 Enter 不发送
    ke.preventDefault()
    onSend()
  }

  function onSend() {
    const text = input.value.trim()
    if (!text || sending.value) return
    if (text.includes('___')) {
      ElMessage.warning('模板里还有 ___ 占位没填')
      return
    }
    input.value = ''
    lastUserText.value = text
    // 还挂着的审批卡：后端会随新消息自动取消，前端同步置灰
    for (const m of msgs.value) {
      if (m.role === 'approval' && m.status === 'pending') m.status = 'skipped'
    }
    push({ role: 'user', text })
    stream({ session: sessionId.value, provider: provider.value, message: text })
  }

  function retryLast() {
    if (!lastUserText.value || sending.value) return
    push({ role: 'user', text: lastUserText.value })
    stream({ session: sessionId.value, provider: provider.value, message: lastUserText.value })
  }

  async function copyText(t: string) {
    try {
      await navigator.clipboard.writeText(t)
      ElMessage.success('已复制')
    } catch {
      ElMessage.warning('复制失败（浏览器限制）')
    }
  }

  async function approve(m: ChatMsg, ok: boolean) {
    if (m.status !== 'pending' || sending.value) return
    if (ok && m.danger) {
      try {
        await ElMessageBox.confirm(`确认执行：${m.label}？此操作不可撤销。`, '高危操作', {
          type: 'warning', confirmButtonText: '执行', cancelButtonText: '再想想'
        })
      } catch {
        return
      }
    }
    m.status = ok ? 'approved' : 'denied'
    stream({
      session: sessionId.value, provider: provider.value,
      approve: { action_id: m.actionId, ok }
    })
  }

  function newChat() {
    aborter?.abort() // 旧流不中止会把回包灌进新会话
    sessionId.value = ''
    msgs.value = []
    lastUserText.value = ''
    showJump.value = false
    autoScroll.value = true
    sessionStorage.removeItem(CONV_KEY)
  }

  // 深链：markdown 里的 /app/ 内链走 router
  function onBodyClick(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest?.('a[data-in]') as HTMLAnchorElement | null
    if (a) {
      e.preventDefault()
      router.push(a.getAttribute('href')!.replace(/^\/app/, ''))
    }
  }

  // ---- 技能 ----
  interface Skill {
    name: string
    prompt: string
  }
  const DEFAULT_SKILLS: Skill[] = [
    { name: '集群现状', prompt: '现在集群整体情况怎么样？哪些节点有空闲卡？' },
    { name: '今日排行', prompt: '今天谁用卡最多？给我看排行，有没有异常偏高的？' },
    { name: '负载走势', prompt: '看一下最近 24 小时集群负载走势，说说忙闲规律。' },
    { name: '查某人用量', prompt: '查一下用户 ___ 最近 30 天的用卡情况' },
    { name: '存储增长', prompt: '共享盘现在谁占得最多？最近 7 天谁涨得最快？' },
    { name: '僵尸容器', prompt: '看看各节点已停止的容器，哪些值得清理？先别动手，给我清理建议。' },
    { name: '登录审计', prompt: '最近 7 天的登录记录里有没有异常来源 IP 或非工作时段的登录？' }
  ]
  const SKILL_KEY = 'gm-ai-skills-v1'
  const skills = ref<Skill[]>(loadSkills())
  function loadSkills(): Skill[] {
    try {
      const raw = localStorage.getItem(SKILL_KEY)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr) && arr.length) return arr
      }
    } catch {
      /* 忽略坏数据 */
    }
    return [...DEFAULT_SKILLS]
  }
  function persistSkills() {
    localStorage.setItem(SKILL_KEY, JSON.stringify(skills.value))
  }
  function useSkill(s: Skill) {
    input.value = s.prompt
    if (!s.prompt.includes('___') && !sending.value) onSend()
  }
  const skillDlg = ref(false)
  const skillIdx = ref(-1)
  const skillDraft = ref<Skill>({ name: '', prompt: '' })
  function openSkillDialog(i = -1) {
    skillIdx.value = i
    skillDraft.value = i >= 0 ? { ...skills.value[i] } : { name: '', prompt: '' }
    skillDlg.value = true
  }
  function saveSkill() {
    if (!skillDraft.value.name.trim() || !skillDraft.value.prompt.trim()) {
      ElMessage.warning('名称和内容都要填')
      return
    }
    if (skillIdx.value >= 0) skills.value[skillIdx.value] = { ...skillDraft.value }
    else skills.value.push({ ...skillDraft.value })
    persistSkills()
    skillDlg.value = false
  }
  function removeSkill(i: number) {
    skills.value.splice(i, 1)
    persistSkills()
  }
</script>

<style scoped lang="scss">
  .ai-page {
    display: flex;
    gap: 16px;
    height: calc(100vh - 150px);
    min-height: 540px;
  }

  .art-card {
    background: var(--default-box-color, #fff);
    border-radius: calc(var(--custom-radius, 8px) + 2px);
  }

  /* ---- 左栏 ---- */
  .side {
    display: flex;
    flex: none;
    flex-direction: column;
    width: 232px;
    padding: 14px;

    .side-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 600;
    }

    .skill-list {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }

    .skill {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 10px;
      margin-bottom: 4px;
      font-size: 12.5px;
      cursor: pointer;
      background: var(--gm-track);
      border-radius: 8px;
      transition: background 0.15s ease;

      &:hover {
        background: color-mix(in srgb, var(--gm-accent) 14%, transparent);

        .ops {
          opacity: 1;
        }
      }

      .ops {
        display: inline-flex;
        gap: 6px;
        opacity: 0;
        transition: opacity 0.15s ease;

        .op {
          font-size: 13px;
          color: var(--art-gray-500, #909399);

          &:hover {
            color: var(--gm-accent);
          }

          &.del:hover {
            color: var(--gm-hot);
          }
        }
      }
    }

    .side-foot {
      padding-top: 10px;
      border-top: 1px solid var(--art-border-dashed-color, rgb(128 128 128 / 15%));
    }
  }

  .pdot {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: 6px;
    background: var(--gm-idle);
    border-radius: 50%;

    &.ready {
      background: var(--gm-ok);
    }
  }

  .pmodel {
    margin-left: 8px;
    font-size: 11px;
    color: var(--art-gray-500, #909399);
  }

  /* ---- 主区 ---- */
  .main {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .jump-btn {
    position: absolute;
    right: 24px;
    bottom: 76px;
    z-index: 3;
    box-shadow: 0 4px 14px rgb(0 0 0 / 22%);
  }

  .chat-head {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 12px 18px;
    border-bottom: 1px solid var(--art-border-dashed-color, rgb(128 128 128 / 15%));

    .title {
      font-size: 15px;
      font-weight: 600;
    }

    .warn-key {
      font-size: 12px;
      color: var(--gm-warn-text);
    }

    .live {
      font-size: 12px;
      color: var(--art-gray-500, #909399);
      white-space: nowrap;
    }
  }

  .chat-body {
    flex: 1;
    min-height: 0;
    padding: 18px 22px;
    overflow-y: auto;
  }

  /* 空态：容器内垂直居中（偏上会留大片尾部空白） */
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 92%;
    text-align: center;

    .orb {
      width: 52px;
      height: 52px;
      margin-bottom: 18px;
      background: radial-gradient(circle at 34% 30%, var(--gm-accent), transparent 72%);
      border-radius: 50%;
      box-shadow: 0 0 34px -6px var(--gm-accent);
      animation: orb-breathe 3.2s ease-in-out infinite;
    }

    .h1 {
      font-size: 19px;
      font-weight: 700;
    }

    .h2 {
      margin-top: 6px;
      font-size: 13px;
      color: var(--art-gray-500, #909399);
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      max-width: 520px;
      margin-top: 22px;
    }

    .chip {
      padding: 5px 14px;
      font-size: 12.5px;
      cursor: pointer;
      background: var(--gm-track);
      border: 1px solid transparent;
      border-radius: 999px;
      transition: all 0.15s ease;

      &:hover {
        color: var(--gm-accent);
        border-color: var(--gm-accent);
      }
    }
  }

  @keyframes orb-breathe {
    50% {
      box-shadow: 0 0 18px -8px var(--gm-accent);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hero .orb {
      animation: none;
    }

    .cursor {
      animation: none;
    }
  }

  /* 消息 */
  .msg-user {
    display: flex;
    justify-content: flex-end;
    margin: 10px 0;

    .bubble {
      max-width: 72%;
      padding: 8px 14px;
      font-size: 13.5px;
      white-space: pre-wrap;
      background: color-mix(in srgb, var(--gm-accent) 16%, transparent);
      border-radius: 12px 12px 3px;
    }
  }

  .msg-ai {
    position: relative;
    max-width: 92%;
    margin: 10px 0;
    font-size: 13.5px;
    line-height: 1.75;

    .cursor {
      color: var(--gm-accent);
      animation: blink 0.9s step-end infinite;
    }

    .copy {
      margin-top: 2px;
      font-size: 14px;
      color: var(--art-gray-400, #a8abb2);
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s ease;

      &:hover {
        color: var(--gm-accent);
      }
    }

    &:hover .copy {
      opacity: 1;
    }
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  .msg-err {
    padding: 8px 12px;
    margin: 10px 0;
    font-size: 12.5px;
    color: var(--gm-hot-text);
    background: color-mix(in srgb, var(--gm-hot) 8%, transparent);
    border-left: 3px solid var(--gm-hot);
    border-radius: 6px;
  }

  .msg-tool {
    padding: 10px 14px;
    margin: 10px 0;
    background: var(--gm-track);
    border-left: 3px solid var(--gm-accent);
    border-radius: 8px;

    &.err {
      border-left-color: var(--gm-hot);
    }

    .tool-head {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: 12.5px;

      .lbl {
        font-weight: 600;
      }

      .etxt {
        color: var(--gm-hot-text);
      }

      .okc {
        color: var(--gm-ok);
      }

      .errc {
        color: var(--gm-hot);
      }

      .spin {
        color: var(--gm-accent);
        animation: rot 1s linear infinite;
      }
    }

    .tool-body {
      margin-top: 8px;
    }
  }

  @keyframes rot {
    to {
      transform: rotate(360deg);
    }
  }

  .msg-approval {
    max-width: 480px;
    padding: 12px 16px;
    margin: 10px 0;
    background: color-mix(in srgb, var(--gm-warn) 8%, transparent);
    border: 1px solid var(--gm-warn);
    border-radius: 10px;

    &.danger {
      background: color-mix(in srgb, var(--gm-hot) 8%, transparent);
      border-color: var(--gm-hot);

      .ap-head {
        color: var(--gm-hot-text);
      }
    }

    .ap-head {
      display: flex;
      gap: 6px;
      align-items: center;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--gm-warn-text);
    }

    .ap-label {
      margin-top: 6px;
      font-size: 14px;
      font-weight: 600;
    }

    .ap-args {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 14px;
      margin-top: 6px;
      font-size: 12px;
      color: var(--art-gray-600, #737a86);
    }

    .ap-btns {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 12px;
    }

    /* 浅色下默认珊瑚红按钮压粉底显得轻飘，加深到与 --gm-hot-text 同档（暗色不动） */
    html:not(.dark) &.danger :deep(.el-button--danger:not(.is-plain)) {
      --el-button-bg-color: #c24136;
      --el-button-border-color: #c24136;
      --el-button-hover-bg-color: #ad372d;
      --el-button-hover-border-color: #ad372d;
    }

    .ap-done {
      margin-top: 10px;
      font-size: 12.5px;
      color: var(--art-gray-500, #909399);
    }
  }

  /* 输入区 */
  .chat-input {
    display: flex;
    gap: 10px;
    align-items: flex-end;
    padding: 12px 16px;
    border-top: 1px solid var(--art-border-dashed-color, rgb(128 128 128 / 15%));
  }

  /* markdown 内容 */
  .md-body {
    :deep(p) {
      margin: 5px 0;
    }

    :deep(code) {
      padding: 1px 5px;
      font-family: var(--gm-mono);
      font-size: 12px;
      background: var(--gm-track);
      border-radius: 4px;
    }

    :deep(pre) {
      padding: 10px 12px;
      margin: 8px 0;
      overflow-x: auto;
      background: var(--gm-track);
      border-radius: 8px;

      code {
        padding: 0;
        background: none;
      }
    }

    :deep(ul),
    :deep(ol) {
      padding-left: 20px;
      margin: 5px 0;

      li {
        margin: 2px 0;
        list-style: disc;
      }
    }

    :deep(ol li) {
      list-style: decimal;
    }

    :deep(h3),
    :deep(h4),
    :deep(h5),
    :deep(h6) {
      margin: 10px 0 4px;
      font-size: 14px;
      font-weight: 700;
    }

    :deep(a) {
      color: var(--gm-accent);

      &:hover {
        text-decoration: underline;
      }
    }

    :deep(.md-tw) {
      margin: 8px 0;
      overflow-x: auto;

      table {
        font-size: 12.5px;
        border-collapse: collapse;

        th,
        td {
          padding: 4px 12px;
          text-align: left;
          border-bottom: 1px solid var(--art-border-dashed-color, rgb(128 128 128 / 18%));
        }

        th {
          font-weight: 600;
          color: var(--art-gray-600, #737a86);
        }
      }
    }
  }
</style>

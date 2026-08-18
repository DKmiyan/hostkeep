<!-- 账号：LDAP 实名账号列表 / 建号 / 出密钥 / 组×节点授权策略 -->
<template>
  <div>
    <template v-if="resp">
      <div class="art-card p-5 mb-5 max-sm:mb-4">
        <div class="flex-b mb-4 flex-wrap gap-2">
          <h3 class="text-base font-medium">实名账号（{{ resp.users.length }} 个）</h3>
          <div class="flex gap-2">
            <ElButton size="small" type="primary" @click="createDlg = true">新建账号</ElButton>
            <ElButton size="small" @click="load" :loading="loading">刷新</ElButton>
          </div>
        </div>
        <ElTable :data="resp.users" size="small">
          <ElTableColumn label="登录名" width="130" sortable prop="uid">
            <template #default="{ row }"><span class="uchip" :style="{ '--c': userColor(row.uid) }">{{ row.uid }}</span></template>
          </ElTableColumn>
          <ElTableColumn prop="cn" label="姓名" width="110" />
          <ElTableColumn label="uid" width="80" sortable prop="uid_number">
            <template #default="{ row }"><span class="gm-num">{{ row.uid_number }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="策略组" width="110">
            <template #default="{ row }">
              <ElTag v-if="row.group" size="small" type="info">{{ row.group }}</ElTag>
              <span v-else class="text-xs text-g-500">-</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="可登录节点" width="110">
            <template #default="{ row }">
              <ElTag
                v-if="(resp.groups[row.group]?.nodes ?? []).length"
                size="small"
                type="info"
                class="gm-num"
                :title="(resp.groups[row.group]?.nodes ?? []).join('  ')"
              >{{ (resp.groups[row.group]?.nodes ?? []).length }} 节点</ElTag>
              <span v-else class="text-xs text-g-500">-</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="home" min-width="170" show-overflow-tooltip>
            <template #default="{ row }"><span class="gm-num text-xs">{{ row.home }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="共享盘用量" width="110" align="right">
            <template #default="{ row }">
              <span
                v-if="row.bytes"
                class="gm-num cursor-pointer text-theme"
                title="查看该目录 30 天趋势"
                @click="router.push({ path: '/storage', query: { dir: row.uid } })"
              >{{ fmtB(row.bytes) }}</span>
              <span v-else class="text-xs text-g-500">-</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <ElButton link type="primary" size="small" @click="keygen(row.uid)">出密钥</ElButton>
              <a class="text-theme text-xs ml-1" :href="`/api/accounts/key?user=${row.uid}`">下载 pem</a>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <div class="art-card p-5 mb-5 max-sm:mb-4">
        <h3 class="text-base font-medium mb-2">组 × 节点授权矩阵</h3>
        <p class="text-xs text-g-500 mb-4">
          勾选后点「保存并下发」：写 groups.json 并向全部节点下发 sshd AllowGroups（含 docker 组同步），失败自动回滚。
          列头省略 AI- 前缀；CSL01/02 为 IB 测试机（不进监控统计，仅授权）。
        </p>
        <div style="overflow-x: auto">
          <ElTable :data="matrixRows" size="small">
            <ElTableColumn label="策略组" width="150" fixed>
              <template #default="{ row }">
                <ElTag size="small" type="info">{{ row.group }}</ElTag>
                <span class="ml-1 text-xs text-g-500 gm-num">gid {{ row.gid }}</span>
              </template>
            </ElTableColumn>
            <ElTableColumn
              v-for="n in resp.nodes"
              :key="n.name"
              :label="n.name.replace('AI-', '')"
              width="72"
              align="center"
            >
              <template #default="{ row }">
                <ElCheckbox v-model="matrix[row.group][n.name]" />
              </template>
            </ElTableColumn>
            <ElTableColumn label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <ElButton
                  size="small"
                  type="primary"
                  :plain="!isDirty(row.group)"
                  :loading="savingGroup === row.group"
                  @click="saveGroup(row.group)"
                >
                  保存并下发{{ isDirty(row.group) ? ' ·未下发' : '' }}
                </ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </div>
        <div class="mt-4 flex gap-2 items-center">
          <ElInput v-model="newGroup" placeholder="新策略组名（如 yhs）" size="small" style="width: 200px" />
          <ElButton size="small" @click="addGroup">添加组</ElButton>
        </div>
        <div v-if="lastApply.length" class="mt-4 text-xs gm-num leading-6 overflow-x-auto">
          <p class="font-semibold mb-1">最近一次下发结果：</p>
          <div v-for="l in lastApply" :key="l" class="whitespace-pre">{{ l }}</div>
        </div>
      </div>
    </template>
    <ElSkeleton v-else :rows="8" animated class="art-card p-5" />

    <!-- 新建账号 -->
    <ElDialog v-model="createDlg" title="新建实名账号" width="480px">
      <ElForm label-width="90px">
        <ElFormItem label="登录名" required>
          <ElInput v-model="cUser" placeholder="小写字母开头，如 zhangsan" />
        </ElFormItem>
        <ElFormItem label="姓名">
          <ElInput v-model="cName" placeholder="中文姓名（写入 LDAP cn）" />
        </ElFormItem>
        <ElFormItem label="策略组" required>
          <ElSelect v-model="cGroup" placeholder="选择策略组">
            <ElOption v-for="(g, name) in resp?.groups ?? {}" :key="name" :label="`${name}（${g.nodes.join(',') || '无节点'}）`" :value="name" />
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <p class="text-xs text-g-500">
        建号即分配 uid、绑定 /slurm-files 同名目录（已存在则 chown 接管，大目录需几分钟）、
        自动加入各授权节点 docker 组。初始密码只显示一次。
      </p>
      <template #footer>
        <ElButton @click="createDlg = false">取消</ElButton>
        <ElButton type="primary" :loading="creating" @click="createUser">创建</ElButton>
      </template>
    </ElDialog>

    <!-- 一次性凭据展示 -->
    <ElDialog v-model="secretDlg" :title="secretTitle" width="560px">
      <ElAlert type="warning" :closable="false" show-icon class="mb-3">
        只显示这一次，请立即复制保存。
      </ElAlert>
      <ElInput type="textarea" :rows="secretRows" :model-value="secretText" readonly />
      <template #footer>
        <ElButton type="primary" @click="copySecret">复制</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { apiGet, apiPost } from '@/gpumon/api'
  import { fmtB, userColor } from '@/gpumon/format'
  import type { AccountsResp } from '@/gpumon/types'
  import { ElMessage, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'Accounts' })

  const resp = ref<AccountsResp | null>(null)
  const loading = ref(false)
  const router = useRouter()
  // matrix[group][node] = checked;orig 为服务端当前值(比对出「未下发」标记)
  const matrix = reactive<Record<string, Record<string, boolean>>>({})
  const orig = reactive<Record<string, Record<string, boolean>>>({})
  const savingGroup = ref('')
  const newGroup = ref('')
  const lastApply = ref<string[]>([])

  async function load() {
    loading.value = true
    try {
      resp.value = await apiGet<AccountsResp>('/api/accounts')
      for (const [g, info] of Object.entries(resp.value.groups)) {
        matrix[g] = matrix[g] ?? {}
        orig[g] = {}
        for (const n of resp.value.nodes) {
          matrix[g][n.name] = info.nodes.includes(n.name)
          orig[g][n.name] = info.nodes.includes(n.name)
        }
      }
    } catch (e) {
      ElMessage.error('获取失败：' + e)
    } finally {
      loading.value = false
    }
  }
  onMounted(load)

  const matrixRows = computed(() =>
    Object.entries(resp.value?.groups ?? {}).map(([group, info]) => ({ group, gid: info.gid }))
  )

  const isDirty = (group: string) => {
    const cur = matrix[group] ?? {}
    const base = orig[group]
    if (!base) return Object.values(cur).some(Boolean) // 新增组:勾了即未下发
    return Object.keys(cur).some((n) => !!cur[n] !== !!base[n])
  }

  function addGroup() {
    const g = newGroup.value.trim()
    if (!/^[a-z][a-z0-9_-]{1,15}$/.test(g)) {
      ElMessage.warning('组名须匹配 ^[a-z][a-z0-9_-]{1,15}$')
      return
    }
    if (!resp.value) return
    if (!resp.value.groups[g]) resp.value.groups[g] = { gid: 0, nodes: [] }
    matrix[g] = matrix[g] ?? {}
    for (const n of resp.value.nodes) matrix[g][n.name] = matrix[g][n.name] ?? false
    newGroup.value = ''
  }

  async function saveGroup(group: string) {
    const nodes = Object.entries(matrix[group] ?? {})
      .filter(([, v]) => v)
      .map(([k]) => k)
    try {
      await ElMessageBox.confirm(
        `保存策略组 ${group} = [${nodes.join(', ') || '无节点'}]，并向全部节点下发 sshd 授权？`,
        '下发组策略',
        { confirmButtonText: '下发', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
    savingGroup.value = group
    try {
      const r = await apiPost<{ ok: boolean; gid: number; results: Record<string, string>; docker: Record<string, string> }>(
        '/api/accounts/group',
        { group, nodes }
      )
      lastApply.value = [
        ...Object.entries(r.results).map(([n, v]) => `${n}: ${v}`),
        ...Object.entries(r.docker ?? {}).map(([n, v]) => `docker ${n}: ${v}`)
      ]
      ElMessage.success(`组 ${group}（gid ${r.gid}）已下发`)
      load()
    } catch (e) {
      ElMessage.error('下发失败：' + e)
    } finally {
      savingGroup.value = ''
    }
  }

  // ---- 新建账号 ----
  const createDlg = ref(false)
  const creating = ref(false)
  const cUser = ref('')
  const cName = ref('')
  const cGroup = ref('')

  // ---- 一次性凭据 ----
  const secretDlg = ref(false)
  const secretTitle = ref('')
  const secretText = ref('')
  const secretRows = ref(3)

  async function createUser() {
    if (!/^[a-z][a-z0-9_-]{1,15}$/.test(cUser.value)) {
      ElMessage.warning('登录名须匹配 ^[a-z][a-z0-9_-]{1,15}$')
      return
    }
    if (!cGroup.value) {
      ElMessage.warning('请选择策略组')
      return
    }
    creating.value = true
    try {
      const r = await apiPost<{ ok: boolean; user: string; uid: number; gid: number; password: string; docker?: Record<string, string> }>(
        '/api/accounts/create',
        { user: cUser.value, name: cName.value, group: cGroup.value }
      )
      createDlg.value = false
      secretTitle.value = `账号 ${r.user} 创建成功（uid ${r.uid}）· 初始密码`
      secretText.value = r.password
      secretRows.value = 2
      secretDlg.value = true
      cUser.value = ''
      cName.value = ''
      load()
    } catch (e) {
      ElMessage.error('创建失败：' + e)
    } finally {
      creating.value = false
    }
  }

  async function keygen(user: string) {
    try {
      await ElMessageBox.confirm(
        `为 ${user} 生成 ed25519 密钥？公钥追加到其共享盘 authorized_keys（全节点生效，旧密钥不失效）；` +
          `注意：「下载 pem」会替换为本次新私钥，旧 pem 请自行留存。`,
        '出密钥',
        { confirmButtonText: '生成', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
    try {
      const r = await apiPost<{ ok: boolean; user: string; private_key: string }>('/api/accounts/keygen', { user })
      secretTitle.value = `${r.user} 的私钥（也可随时点「下载 pem」）`
      secretText.value = r.private_key
      secretRows.value = 8
      secretDlg.value = true
    } catch (e) {
      ElMessage.error('出密钥失败：' + e)
    }
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secretText.value)
      ElMessage.success('已复制')
    } catch {
      ElMessage.warning('复制失败，请手动选择复制')
    }
  }
</script>

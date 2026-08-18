// gpu-mon 后端 JSON 结构（与 main.go 一一对应，仅列前端用到的字段）

export interface GPU {
  index: number
  uuid: string
  name: string
  util: number
  mem_used: number
  mem_total: number
  temp: number
  power_draw: number
  power_limit: number
}

export interface Proc {
  pid: number
  gpus: number[]
  gpu_mem_mb: number
  user: string
  container?: string
  cmd: string
  start?: string
  launch?: string
  chain?: string
}

export interface NodeStatus {
  name: string
  ip: string
  type: string
  role: string
  online: boolean
  error?: string
  hostname?: string
  load1: number
  load5: number
  load15: number
  cpu_pct: number
  nproc: number
  mem_total_mb: number
  mem_used_mb: number
  swap_total_mb: number
  swap_used_mb: number
  root_total_mb: number
  root_used_mb: number
  net_rx_kbs: number
  net_tx_kbs: number
  docker_running: number
  docker_total: number
  gpus: GPU[]
  procs: Proc[]
  collect_ms: number
  updated: string
}

export interface SharedDisk {
  path: string
  total_gb: number
  used_gb: number
  used_pct: number
}

export interface UserStat {
  user: string
  gpus: string[]
  gpu_mem_mb: number
  procs: number
  gpu_hours_today: number
  max_gpus_today: number
}

export interface ClusterStat {
  nodes_online: number
  nodes_total: number
  gpu_total: number
  gpu_alloc_total: number
  gpu_in_use: number
  gpu_util_avg: number
  gpu_mem_used_mb: number
  gpu_mem_total_mb: number
  cores_total: number
  cpu_pct_avg: number
  mem_used_mb: number
  mem_total_mb: number
  swap_used_mb: number
  swap_total_mb: number
  net_rx_kbs: number
  net_tx_kbs: number
  active_users: number
}

export interface StorageUser {
  name: string
  bytes: number
  delta7d?: number // 相对 ~7 天前的增量字节（后端无基线时缺省）
}

export interface StorageSnap {
  path: string
  scanning: boolean
  prog_dirs?: number
  prog_bytes?: number
  prog_cur?: string
  last_scan?: string
  duration_sec: number
  last_error?: string
  scanned_today: boolean
  scan_hour: number
  scan_window: number
  cpu_threshold: number
  users: StorageUser[]
  total_bytes: number
  trend: { date: string; total_bytes: number }[]
}

export interface UserLimit {
  max_gpus: number
  enforce: boolean
}

export interface EnforceEvent {
  ts: string
  user: string
  limit: number
  using: number
  dry_run: boolean
  actions?: string[]
}

export interface Snapshot {
  timestamp: string
  interval_sec: number
  attr_mode?: 'legacy' | 'account'
  control?: NodeStatus
  disk?: SharedDisk
  storage?: StorageSnap
  cluster: ClusterStat
  nodes: NodeStatus[]
  users: UserStat[]
  limits?: Record<string, UserLimit>
  enforce_events?: EnforceEvent[]
}

// ---- /api/series（分钟级集群时序，后端保留 48h） ----

export interface SeriesPoint {
  t: number // 分钟起点 unix 秒
  gpu: number // GPU 利用率 %
  gpu_used: number // 平均在用卡数
  cpu: number
  mem: number // 显存 %
  rx: number // KB/s
  tx: number
  au?: number // 活跃用户数
}

export interface SeriesResp {
  interval_sec: number
  points: SeriesPoint[]
}

// ---- /api/usage（按天用量日志：历史 + 今天累计器） ----

export interface UsageDayUser {
  gpu_hours: number
  avg_gpus: number
  max_gpus: number
  mem_gb_hours: number
  storage_bytes?: number
}

export interface UsageDayLog {
  date: string
  wall_hours: number
  users: Record<string, UsageDayUser>
}

export interface UsageResp {
  today: {
    date: string
    samples: number
    users: Record<string, { gpu_seconds: number; mem_gb_seconds: number; max_gpus: number }>
  } | null
  history: UsageDayLog[] | null
}

// ---- /api/docker ----

export interface DockerCont {
  name: string
  state: string
  exit_code: number
  image: string
  created: string
  started?: string
  entry?: string
  restart: string
  size: string
  size_rw_b: number
  user: string
  // 实时资源（docker stats，仅运行中容器；缺采为 undefined/0）
  cpu_pct?: number
  mem_used_b?: number
  mem_limit_b?: number
  mem_pct?: number
  pids?: number
}

export interface DockerNode {
  name: string
  ip: string
  role: string
  online: boolean
  running: number
  total: number
  containers: DockerCont[]
}

export interface DockerResp {
  timestamp: string
  control?: DockerNode
  nodes: DockerNode[]
}

// ---- /api/audit ----

export interface LoginRec {
  user: string
  tty: string
  ip: string
  login: string
  logout?: string
  online: boolean
}

export interface AuditNode {
  name: string
  online: boolean
  crons: string[]
  logins: LoginRec[]
}

export interface AuditResp {
  timestamp: string
  nodes: AuditNode[]
}

// ---- /api/accounts ----

export interface AccountUser {
  uid: string
  cn: string
  uid_number: number
  gid_number: number
  home: string
  group: string
  bytes?: number
}

export interface AccountGroupInfo {
  gid: number
  nodes: string[]
}

export interface AccountsResp {
  timestamp: string
  users: AccountUser[]
  groups: Record<string, AccountGroupInfo>
  nodes: { name: string; ip: string; type: string; role: string }[]
  apply_status: Record<string, string>
}

// ---- /api/storage/history ----

export interface StorageHistoryResp {
  name: string
  days: { date: string; bytes: number }[]
  current_bytes?: number
}

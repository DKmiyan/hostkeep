// 数值格式化 + 状态配色 + 用户哈希色（色板与旧版一致，用户颜色跨版本不变）

export const fmtG = (mb: number): string =>
  mb >= 1024 ? (mb / 1024).toFixed(1) + 'G' : mb + 'M'

export const fmtT = (mb: number): string => (mb / 1048576).toFixed(1) + 'T'

export const fmtB = (b: number): string =>
  b >= 1e12 ? (b / 1e12).toFixed(2) + 'T'
  : b >= 1e9 ? (b / 1e9).toFixed(1) + 'G'
  : (b / 1e6).toFixed(0) + 'M'

// 容量类阈值配色（内存/磁盘/显存占用）：0 灰 / <40 绿 / <80 黄 / >=80 红——红=容量告警
export const utilColor = (u: number): string =>
  u >= 80 ? 'var(--gm-hot)' : u >= 40 ? 'var(--gm-warn)' : u > 0 ? 'var(--gm-ok)' : 'var(--gm-idle)'

// 负载类配色（GPU 利用率/CPU）：高档用「负载橙」而非告警红——满负荷是集群常态不是事故，
// 纯红留给真正要行动的信号（容量告警/离线/熔断）
export const loadColor = (u: number): string =>
  u >= 80 ? 'var(--gm-load)' : u >= 40 ? 'var(--gm-warn)' : u > 0 ? 'var(--gm-ok)' : 'var(--gm-idle)'

// 状态色作"文字"时用（浅色下填充色当文字对比度不足，token 分离）
export const utilTextColor = (u: number): string =>
  u >= 80 ? 'var(--gm-hot-text)' : u >= 40 ? 'var(--gm-warn-text)' : u > 0 ? 'var(--gm-ok-text)' : 'var(--art-gray-500, #909399)'
export const loadTextColor = (u: number): string =>
  u >= 80 ? 'var(--gm-load-text)' : u >= 40 ? 'var(--gm-warn-text)' : u > 0 ? 'var(--gm-ok-text)' : 'var(--art-gray-500, #909399)'

// 用户哈希色板：16 色等距色相（2026-08-18 从 10 色扩容——原色板 23+ 账号碰撞率过高，
// szs/sjy 等相邻同色，签名元素失效；此为一次性断代，新旧色不完全对应。
// 08-19 微调两个红系槽位（#bd5a51/#b05a6e→赭褐/灰玫），与告警红 --gm-hot 拉开距离，
// 避免 treemap/大色块场景被误读为告警）
// 08-19 二调：三个亮色槽位（土黄/黄绿/中绿）加深一档，白字 chip 在浅色主题下对比不足
const PALETTE = [
  '#a3685f', '#c96a3f', '#a1772e', '#8a7a30',
  '#69894b', '#4f9e78', '#3f9a94', '#4f92ad',
  '#5f86c0', '#6a7ab0', '#8f86c9', '#8a6aa0',
  '#a468b8', '#b85aa2', '#a0607e', '#996e5b'
]

export function userColor(name: string): string {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

// 监控图固定线色（明暗通用，避开模板默认蓝紫与 16 色哈希板）：
// GPU=品牌青，CPU=青灰，显存=暖黄（与状态环容量色同系），网络=灰系
export const CHART_COLORS = {
  gpu: '#0EA5A0',
  cpu: '#5b8a9a',
  mem: '#cf9a3c',
  rx: '#8b95a8',
  tx: '#c2a04d',
  hours: '#0EA5A0'
} as const

// 大色块上的文字色：按背景亮度自动切黑/白（treemap 标签等）。
// 阈值 118：色板里的土黄/黄绿/浅紫（亮度 130~145）白字只有 ~3:1，深字更稳
export function onColorText(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return lum > 118 ? 'rgba(20,18,14,0.88)' : '#fff'
}

// ECharts 轴/浮层配色（canvas 里用不了 CSS 变量，按明暗给实体色）
export const chartAxisStyle = (dark: boolean) => ({
  label: dark ? '#8a8f99' : '#8b90a0',
  split: dark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)',
  tooltipBg: dark ? '#1b1d23' : '#fff',
  tooltipText: dark ? '#e3e5ea' : '#303133',
  cardBg: dark ? '#161618' : '#ffffff' // 模板 --default-box-color 实值（canvas 用不了 CSS 变量）
})

export const GM_MONO_FONT = 'ui-monospace, SF Mono, Menlo, Consolas, monospace'

export const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('zh-CN', { hour12: false })

// 统一 YYYY-MM-DD HH:mm:ss（补零，等宽字体下位数对齐）
export const fmtDateTime = (iso?: string): string => {
  if (!iso || iso.startsWith('0001')) return '-'
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

// 带符号的字节增量（存储 7 日增量列用）
export const fmtDelta = (b: number): string => (b >= 0 ? '+' : '-') + fmtB(Math.abs(b))

// 时长：秒 → "3d5h" / "5h12m" / "42m"
export const fmtDur = (sec: number): string => {
  if (sec < 0) sec = 0
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}d${h}h`
  if (h > 0) return `${h}h${m}m`
  return `${m}m`
}

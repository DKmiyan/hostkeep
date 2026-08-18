import { defineStore } from 'pinia'
import type { Snapshot } from './types'
import { apiGet } from './api'

// 会话内滚动采样（概览页监控图用）
export interface HistPoint {
  t: number
  gpuUtil: number
  cpuPct: number
  netRxKBs: number
  netTxKBs: number
}
const HIST_MAX = 360 // 10s 一点，约 1 小时

/** 全站共享的集群状态快照：App 启动轮询，各页面直接读 */
export const useStatusStore = defineStore('gpumonStatus', () => {
  const snap = ref<Snapshot | null>(null)
  const error = ref('')
  const loading = ref(true)
  const hist = ref<HistPoint[]>([])
  let timer: ReturnType<typeof setInterval> | 0 = 0

  const allocNodes = computed(() => (snap.value?.nodes ?? []).filter((n) => n.role !== 'ib-test'))

  async function refresh() {
    try {
      const s = await apiGet<Snapshot>('/api/status')
      snap.value = s
      error.value = ''
      const ts = new Date(s.timestamp).getTime()
      const h = hist.value
      if (!h.length || h[h.length - 1].t !== ts) {
        h.push({
          t: ts,
          gpuUtil: s.cluster.gpu_util_avg,
          cpuPct: s.cluster.cpu_pct_avg,
          netRxKBs: s.cluster.net_rx_kbs,
          netTxKBs: s.cluster.net_tx_kbs
        })
        if (h.length > HIST_MAX) h.splice(0, h.length - HIST_MAX)
      }
    } catch (e) {
      error.value = String(e)
      if (String(e).includes('unauthorized')) stopPolling() // 已登出，别再打了
    } finally {
      loading.value = false
    }
  }

  function startPolling(ms = 10000) {
    if (timer) return
    refresh()
    timer = setInterval(refresh, ms)
  }

  function stopPolling() {
    if (timer) {
      clearInterval(timer)
      timer = 0
    }
  }

  return { snap, error, loading, hist, allocNodes, refresh, startPolling, stopPolling }
})

// gpu-mon 后端访问层：Cookie 会话 + 明文 JSON，不走模板的 axios/token 体系。
// 401 统一登出（清模板登录态并回登录页）。

import { useUserStore } from '@/store/modules/user'

export async function apiGet<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (r.status === 401) {
    useUserStore().logOut()
    throw new Error('unauthorized')
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
  return r.json()
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  if (r.status === 401) {
    useUserStore().logOut()
    throw new Error('unauthorized')
  }
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

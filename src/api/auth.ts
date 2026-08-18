import { ElMessage } from 'element-plus'

/**
 * 对接 gpu-mon 后端的 Cookie 会话认证（非 token 体系）：
 * 登录成功后后端直接种 HttpOnly Cookie；模板需要一个 token 维持前端登录态，
 * 存占位值即可，真正的鉴权靠 Cookie + 各 API 的 401。
 */
export async function fetchLogin(params: Api.Auth.LoginParams): Promise<Api.Auth.LoginResponse> {
  const r = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: params.userName, pass: params.password })
  })
  let ok = false
  try {
    ok = r.ok && (await r.json()).ok === true
  } catch {
    ok = false
  }
  if (!ok) {
    ElMessage.error('账号或密码错误')
    throw new Error('login failed')
  }
  return { token: 'cookie-session', refreshToken: '' }
}

/**
 * 后端无用户信息接口（单管理员 Cookie 会话），返回静态管理员身份
 */
export async function fetchGetUserInfo(): Promise<Api.Auth.UserInfo> {
  return { buttons: [], roles: ['R_SUPER'], userId: 1, userName: 'admin', email: '' }
}

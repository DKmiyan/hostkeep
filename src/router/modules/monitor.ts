import { AppRouteRecord } from '@/types/router'

/**
 * gpu-mon 业务路由：全部为一级菜单（无 children 的顶级路由由
 * RouteTransformer 自动包 Layout），标题用纯中文（不走 i18n key）。
 */
export const monitorRoutes: AppRouteRecord[] = [
  {
    name: 'Overview',
    path: '/overview',
    component: '/monitor/overview',
    meta: { title: '概览', icon: 'ri:dashboard-3-line', keepAlive: false, fixedTab: true }
  },
  {
    name: 'AiConsole',
    path: '/ai',
    component: '/monitor/ai',
    meta: { title: 'AI 驾驶舱', icon: 'ri:robot-2-line', keepAlive: true }
  },
  {
    name: 'Gpu',
    path: '/gpu',
    component: '/monitor/gpu',
    meta: { title: 'GPU', icon: 'ri:cpu-line', keepAlive: false }
  },
  {
    name: 'Host',
    path: '/host',
    component: '/monitor/host',
    meta: { title: 'CPU · 主机', icon: 'ri:server-line', keepAlive: false }
  },
  {
    name: 'Users',
    path: '/users',
    component: '/monitor/users',
    meta: { title: '用户', icon: 'ri:group-line', keepAlive: false }
  },
  {
    name: 'Storage',
    path: '/storage',
    component: '/monitor/storage',
    meta: { title: '存储', icon: 'ri:database-2-line', keepAlive: false }
  },
  {
    name: 'Docker',
    path: '/docker',
    component: '/monitor/docker',
    meta: { title: '容器', icon: 'ri:ship-line', keepAlive: false }
  },
  {
    name: 'Audit',
    path: '/audit',
    component: '/monitor/audit',
    meta: { title: '审计', icon: 'ri:file-search-line', keepAlive: false }
  },
  {
    name: 'Accounts',
    path: '/accounts',
    component: '/monitor/accounts',
    meta: { title: '账号', icon: 'ri:user-settings-line', keepAlive: false }
  }
]

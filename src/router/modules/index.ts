import { AppRouteRecord } from '@/types/router'
import { monitorRoutes } from './monitor'
import { exceptionRoutes } from './exception'
import { extraDashRoutes, extraPagesRoutes, extraWidgetsRoutes } from './extras'

/**
 * 导出所有模块化路由
 * gpu-mon 业务页 + 异常页（守卫依赖 404/500）+「其他」演示板块（模板原始页面空挂，评估用）
 */
export const routeModules: AppRouteRecord[] = [
  ...monitorRoutes,
  extraDashRoutes,
  extraPagesRoutes,
  extraWidgetsRoutes,
  exceptionRoutes
]

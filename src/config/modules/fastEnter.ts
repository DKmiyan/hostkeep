/**
 * 快速入口配置（顶栏九宫格弹出）——只挂本系统的真实页面
 */
import type { FastEnterConfig } from '@/types/config'

const fastEnterConfig: FastEnterConfig = {
  // 显示条件（屏幕宽度）
  minWidth: 1200,
  // 应用列表
  applications: [
    {
      name: '概览',
      description: '集群总览与实时热度',
      icon: 'ri:dashboard-3-line',
      iconColor: '#377dff',
      enabled: true,
      order: 1,
      routeName: 'Overview'
    },
    {
      name: 'GPU',
      description: '每卡利用率与占用进程',
      icon: 'ri:cpu-line',
      iconColor: '#7c5cff',
      enabled: true,
      order: 2,
      routeName: 'Gpu'
    },
    {
      name: '用户',
      description: '卡时排行与限额熔断',
      icon: 'ri:group-line',
      iconColor: '#ffb100',
      enabled: true,
      order: 3,
      routeName: 'Users'
    },
    {
      name: '容器',
      description: '全节点容器与一键清理',
      icon: 'ri:ship-line',
      iconColor: '#00c8d0',
      enabled: true,
      order: 4,
      routeName: 'Docker'
    },
    {
      name: '存储',
      description: '共享盘用量与趋势',
      icon: 'ri:database-2-line',
      iconColor: '#52c41a',
      enabled: true,
      order: 5,
      routeName: 'Storage'
    },
    {
      name: '审计',
      description: '登录记录与进程溯源',
      icon: 'ri:file-search-line',
      iconColor: '#ff6b6b',
      enabled: true,
      order: 6,
      routeName: 'Audit'
    }
  ],
  // 快速链接
  quickLinks: [
    {
      name: '账号管理',
      enabled: true,
      order: 1,
      routeName: 'Accounts'
    },
    {
      name: '概览',
      enabled: true,
      order: 2,
      routeName: 'Overview'
    },
    {
      name: '审计',
      enabled: true,
      order: 3,
      routeName: 'Audit'
    }
  ]
}

export default Object.freeze(fastEnterConfig)

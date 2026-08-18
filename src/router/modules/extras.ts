import { AppRouteRecord } from '@/types/router'

/**
 * 「其他」板块：art-design-pro 模板自带的演示页面，空挂 + 模拟数据，
 * 用于评估原模板的组织方式与可吸收的设计；确认无用后可整组删除。
 * 排除项：外链 iframe（离线不可用）、权限切换演示（会改动登录角色状态）、Socket 连接演示（无对端）。
 */

// 其他一 · 模板仪表盘：原版三块仪表盘 + 服务器监控演示
export const extraDashRoutes: AppRouteRecord = {
  path: '/extra-dash',
  name: 'ExtraDash',
  component: '/index/index',
  meta: { title: '其他一 · 仪表盘', icon: 'ri:dashboard-3-line', showTextBadge: '演示' },
  children: [
    {
      path: 'console',
      name: 'ExtraConsole',
      component: '/dashboard/console',
      meta: { title: '工作台', icon: 'ri:home-smile-2-line', keepAlive: false }
    },
    {
      path: 'analysis',
      name: 'ExtraAnalysis',
      component: '/dashboard/analysis',
      meta: { title: '分析页', icon: 'ri:pie-chart-2-line', keepAlive: false }
    },
    {
      path: 'ecommerce',
      name: 'ExtraEcommerce',
      component: '/dashboard/ecommerce',
      meta: { title: '电子商务', icon: 'ri:shopping-bag-3-line', keepAlive: false }
    },
    {
      path: 'server',
      name: 'ExtraServer',
      component: '/safeguard/server',
      meta: { title: '服务器管理', icon: 'ri:server-line', keepAlive: false }
    }
  ]
}

// 其他二 · 模板页面：成套页面模板（聊天/卡片/图表/地图…）+ 文章管理 + 系统管理
export const extraPagesRoutes: AppRouteRecord = {
  path: '/extra-pages',
  name: 'ExtraPages',
  component: '/index/index',
  meta: { title: '其他二 · 页面模板', icon: 'ri:layout-4-line', showTextBadge: '演示' },
  children: [
    {
      path: 'chat',
      name: 'ExtraChat',
      component: '/template/chat',
      meta: { title: '聊天', icon: 'ri:message-3-line', keepAlive: true }
    },
    {
      path: 'cards',
      name: 'ExtraCards',
      component: '/template/cards',
      meta: { title: '卡片', icon: 'ri:wallet-line', keepAlive: false }
    },
    {
      path: 'banners',
      name: 'ExtraBanners',
      component: '/template/banners',
      meta: { title: '横幅', icon: 'ri:rectangle-line', keepAlive: false }
    },
    {
      path: 'charts',
      name: 'ExtraCharts',
      component: '/template/charts',
      meta: { title: '图表', icon: 'ri:bar-chart-box-line', keepAlive: false }
    },
    {
      path: 'map',
      name: 'ExtraMap',
      component: '/template/map',
      meta: { title: '地图', icon: 'ri:map-pin-line', keepAlive: true }
    },
    {
      path: 'calendar',
      name: 'ExtraCalendar',
      component: '/template/calendar',
      meta: { title: '日历', icon: 'ri:calendar-2-line', keepAlive: true }
    },
    {
      path: 'pricing',
      name: 'ExtraPricing',
      component: '/template/pricing',
      meta: { title: '定价', icon: 'ri:money-cny-box-line', keepAlive: true, isFullPage: true }
    },
    {
      path: 'article-list',
      name: 'ExtraArticleList',
      component: '/article/list',
      meta: { title: '文章列表', icon: 'ri:article-line', keepAlive: true }
    },
    {
      path: 'detail/:id',
      name: 'ExtraArticleDetail',
      component: '/article/detail',
      meta: { title: '文章详情', isHide: true, keepAlive: true, activePath: '/extra-pages/article-list' }
    },
    {
      path: 'publish',
      name: 'ExtraArticlePublish',
      component: '/article/publish',
      meta: { title: '文章发布', icon: 'ri:edit-box-line', keepAlive: true }
    },
    {
      path: 'comment',
      name: 'ExtraArticleComment',
      component: '/article/comment',
      meta: { title: '留言管理', icon: 'ri:chat-quote-line', keepAlive: true }
    },
    {
      path: 'sys-user',
      name: 'ExtraSysUser',
      component: '/system/user',
      meta: { title: '用户管理', icon: 'ri:user-3-line', keepAlive: true }
    },
    {
      path: 'sys-role',
      name: 'ExtraSysRole',
      component: '/system/role',
      meta: { title: '角色管理', icon: 'ri:shield-user-line', keepAlive: true }
    },
    {
      path: 'sys-menu',
      name: 'ExtraSysMenu',
      component: '/system/menu',
      meta: { title: '菜单管理', icon: 'ri:menu-2-line', keepAlive: true }
    },
    {
      path: 'user-center',
      name: 'ExtraUserCenter',
      component: '/system/user-center',
      meta: { title: '个人中心', icon: 'ri:account-circle-line', keepAlive: true, isHide: true }
    },
    {
      path: 'success',
      name: 'ExtraResultSuccess',
      component: '/result/success',
      meta: { title: '成功页', icon: 'ri:checkbox-circle-line', keepAlive: true }
    },
    {
      path: 'fail',
      name: 'ExtraResultFail',
      component: '/result/fail',
      meta: { title: '失败页', icon: 'ri:close-circle-line', keepAlive: true }
    }
  ]
}

// 其他三 · 组件与示例：小组件 + 表格/表单示例
export const extraWidgetsRoutes: AppRouteRecord = {
  path: '/extra-widgets',
  name: 'ExtraWidgets',
  component: '/index/index',
  meta: { title: '其他三 · 组件示例', icon: 'ri:shapes-line', showTextBadge: '演示' },
  children: [
    {
      path: 'icon',
      name: 'ExtraIcon',
      component: '/widgets/icon',
      meta: { title: '图标', icon: 'ri:remixicon-line', keepAlive: true }
    },
    {
      path: 'image-crop',
      name: 'ExtraImageCrop',
      component: '/widgets/image-crop',
      meta: { title: '图像裁剪', icon: 'ri:crop-line', keepAlive: true }
    },
    {
      path: 'excel',
      name: 'ExtraExcel',
      component: '/widgets/excel',
      meta: { title: 'Excel 导入导出', icon: 'ri:file-excel-2-line', keepAlive: true }
    },
    {
      path: 'video',
      name: 'ExtraVideo',
      component: '/widgets/video',
      meta: { title: '视频播放器', icon: 'ri:video-line', keepAlive: true }
    },
    {
      path: 'count-to',
      name: 'ExtraCountTo',
      component: '/widgets/count-to',
      meta: { title: '数字滚动', icon: 'ri:numbers-line', keepAlive: true }
    },
    {
      path: 'wang-editor',
      name: 'ExtraWangEditor',
      component: '/widgets/wang-editor',
      meta: { title: '富文本编辑器', icon: 'ri:text-block', keepAlive: true }
    },
    {
      path: 'watermark',
      name: 'ExtraWatermark',
      component: '/widgets/watermark',
      meta: { title: '水印', icon: 'ri:drop-line', keepAlive: true }
    },
    {
      path: 'context-menu',
      name: 'ExtraContextMenu',
      component: '/widgets/context-menu',
      meta: { title: '右键菜单', icon: 'ri:cursor-line', keepAlive: true }
    },
    {
      path: 'qrcode',
      name: 'ExtraQrcode',
      component: '/widgets/qrcode',
      meta: { title: '二维码', icon: 'ri:qr-code-line', keepAlive: true }
    },
    {
      path: 'drag',
      name: 'ExtraDrag',
      component: '/widgets/drag',
      meta: { title: '拖拽', icon: 'ri:drag-move-2-line', keepAlive: true }
    },
    {
      path: 'text-scroll',
      name: 'ExtraTextScroll',
      component: '/widgets/text-scroll',
      meta: { title: '文字滚动', icon: 'ri:text-spacing', keepAlive: true }
    },
    {
      path: 'fireworks',
      name: 'ExtraFireworks',
      component: '/widgets/fireworks',
      meta: { title: '礼花', icon: 'ri:sparkling-2-line', keepAlive: true }
    },
    {
      path: 'tabs',
      name: 'ExtraTabs',
      component: '/examples/tabs',
      meta: { title: '标签页', icon: 'ri:folder-2-line', keepAlive: true }
    },
    {
      path: 'tables-basic',
      name: 'ExtraTablesBasic',
      component: '/examples/tables/basic',
      meta: { title: '基础表格', icon: 'ri:table-line', keepAlive: true }
    },
    {
      path: 'tables',
      name: 'ExtraTables',
      component: '/examples/tables',
      meta: { title: '高级表格', icon: 'ri:table-alt-line', keepAlive: true }
    },
    {
      path: 'tables-tree',
      name: 'ExtraTablesTree',
      component: '/examples/tables/tree',
      meta: { title: '左右布局表格', icon: 'ri:layout-column-line', keepAlive: true }
    },
    {
      path: 'forms',
      name: 'ExtraForms',
      component: '/examples/forms',
      meta: { title: '表单', icon: 'ri:file-list-3-line', keepAlive: true }
    },
    {
      path: 'search-bar',
      name: 'ExtraSearchBar',
      component: '/examples/forms/search-bar',
      meta: { title: '搜索表单', icon: 'ri:search-2-line', keepAlive: true }
    }
  ]
}

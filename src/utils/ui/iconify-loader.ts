/**
 * 离线图标加载器 —— 部署环境是无外网的内网，图标必须离线打包。
 * 预注册 ri 图标集（全站唯一在用的集合），避免运行时从 CDN 拉取。
 * 新增其他集合时：pnpm/npm add -D @iconify-json/<set> 并在此注册。
 */

import { addCollection } from '@iconify/vue'
import riIcons from '@iconify-json/ri/icons.json'

addCollection(riIcons)

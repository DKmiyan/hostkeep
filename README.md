# hostkeep web

GPU 集群运维面板前端。基于 [art-design-pro](https://github.com/Daymychen/art-design-pro)
（MIT，版权归原作者，见 `LICENSE-art-design-pro`）二次开发：保留其外壳与组件体系
（布局/主题/明暗模式/全局搜索/多标签页），业务页面全部为本仓库实现。

技术栈：Vue 3 + TypeScript + Vite + Element Plus + ECharts + Tailwind CSS。

## 页面

- **概览**：KPI 卡、GPU/显存/CPU/存储圆环、实时采样面积图、节点×GPU 热度墙、节点一览
- **GPU**：每节点卡级明细（利用率/显存/温度/功耗/占用者）+ GPU 进程表
- **CPU · 主机**：节点资源明细 + 控制节点状态
- **用户**：用量排行（可展开跨节点进程明细）、限额与熔断事件
- **存储**：共享盘总览、目录用量、集群总量趋势、单目录 30 天趋势
- **容器**：全节点容器明细、单删/批量清理（仅已停止容器）
- **审计**：登录记录按人聚合、GPU 进程启动溯源、定时任务清单
- **账号**：LDAP 实名账号列表、建号、出密钥、组×节点授权矩阵下发

## 特点

- **纯静态产物**：`npm run build` 输出 `dist/`，任何 HTTP 服务器可托管；
  零运行时外部请求（图标离线打包，无 CDN/外部字体），适合离线内网
- 数据来自一组 JSON 接口（`/api/status` 等，Cookie 会话认证），后端不在本仓库
- 用户标识稳定哈希配色，跨页面、跨版本颜色一致

## 开发

```bash
npm install
npm run dev     # http://127.0.0.1:5180/app/，/api 代理见 vite.config.ts + .env.development
npm run build   # 产物在 dist/
```

## 许可

见 `LICENSE`（模板部分 MIT 归原作者；本仓库新增部分保留所有权利）。

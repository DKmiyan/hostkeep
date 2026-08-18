<script setup lang="ts">
import type { NodeStatus } from '../types'
import { loadColor, userColor, fmtG } from '../format'

const props = defineProps<{ nodes: NodeStatus[] }>()
const router = useRouter()

interface Cell {
  util: number
  title: string
  color: string
  owner: string
  idle: boolean
}

const rows = computed(() =>
  props.nodes.map((n) => {
    const cells: Cell[] = (n.gpus ?? []).map((g) => {
      const owners = new Set<string>()
      for (const p of n.procs ?? []) if (p.gpus.includes(g.index)) owners.add(p.user)
      const util = n.online ? g.util : 0
      // idle=真空闲（无人占用且 0%）；被占用但 0% 的格子仍显数字 0 + 归属色条（闲置占卡要看得出来）
      const idle = util === 0 && owners.size === 0
      return {
        util,
        idle,
        color: n.online && !idle ? loadColor(Math.max(util, 1)) : 'var(--gm-track)',
        owner: owners.size ? userColor([...owners][0]) : '',
        title:
          `${n.name} GPU${g.index} · ${util}% · ${fmtG(g.mem_used)}/${fmtG(g.mem_total)}` +
          (owners.size ? ` · ${[...owners].join(',')}` : ' · 空闲')
      }
    })
    const inUse = new Set<number>()
    for (const p of n.procs ?? []) p.gpus.forEach((i) => inUse.add(i))
    const avg = cells.length ? Math.round(cells.reduce((a, c) => a + c.util, 0) / cells.length) : 0
    return { name: n.name, type: n.type, online: n.online, cells, used: inUse.size, avg }
  })
)

// 点格子 → GPU 页对应节点的对应卡；点节点名 → GPU 页对应节点
const goCell = (node: string, gpu: number) => router.push({ path: '/gpu', query: { node, gpu } })
const goNode = (node: string) => router.push({ path: '/gpu', query: { node } })
</script>

<template>
  <div class="heatwall">
    <div v-for="r in rows" :key="r.name" class="hrow">
      <span
        class="hname"
        role="link"
        tabindex="0"
        :title="`查看 ${r.name} 明细`"
        @click="goNode(r.name)"
        @keydown.enter="goNode(r.name)"
      >{{ r.name }}</span>
      <span class="gm-tag" :class="r.type === 'A100' ? 'a100' : 'l40s'">{{ r.type }}</span>
      <div class="hcells">
        <div
          v-for="(c, i) in r.cells"
          :key="i"
          class="hcell"
          :class="{ idle: c.idle }"
          :style="{ background: c.color, '--g': c.color }"
          :title="c.title"
          tabindex="0"
          @click="goCell(r.name, i)"
          @keydown.enter="goCell(r.name, i)"
        >
          <!-- 空闲格不渲染数字（行尾已有汇总），降低整墙噪声 -->
          <template v-if="!c.idle">{{ c.util }}</template>
          <span v-if="c.owner" class="owner" :style="{ background: c.owner }" />
        </div>
      </div>
      <span class="hsum">
        <template v-if="r.online">
          <span v-if="r.cells.length - r.used > 0" class="hfree">{{ r.cells.length - r.used }} 空</span>
          <span v-else>0 空</span>
          · 在用 {{ r.used }} · 均 {{ r.avg }}%
        </template>
        <template v-else><span style="color: var(--gm-hot)">离线</span></template>
      </span>
    </div>
  </div>
</template>

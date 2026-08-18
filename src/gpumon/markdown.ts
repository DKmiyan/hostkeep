// 极简 markdown 渲染（离线零依赖）：先整体 HTML 转义再组装白名单标签，杜绝注入。
// 支持：#~#### 标题、**粗体**、`行内代码`、```围栏代码```、-/1. 列表、| 表格 |、
// [文字](url) 链接——内部 /app 路由链接打 data-in 标记由页面接管跳转，外链新窗口。

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function inline(s: string): string {
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t: string, u: string) => {
    if (u.startsWith('/app/')) return `<a href="${u}" data-in="1">${t}</a>`
    if (/^https?:\/\//.test(u)) return `<a href="${u}" target="_blank" rel="noopener">${t}</a>`
    return t
  })
  return s
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())

export function renderMarkdown(src: string): string {
  const out: string[] = []
  const lines = esc(src ?? '').split('\n')
  let i = 0
  while (i < lines.length) {
    const l = lines[i]
    if (l.startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      i++
      out.push(`<pre><code>${buf.join('\n')}</code></pre>`)
      continue
    }
    const h = l.match(/^(#{1,4})\s+(.*)/)
    if (h) {
      const lvl = Math.min(h[1].length + 2, 6)
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`)
      i++
      continue
    }
    if (/^\s*[-*]\s+/.test(l)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`)
        i++
      }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(l)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*\d+[.)]\s+/, ''))}</li>`)
        i++
      }
      out.push(`<ol>${items.join('')}</ol>`)
      continue
    }
    if (l.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const heads = cells(l).map((c) => `<th>${inline(c)}</th>`)
      i += 2
      const rows: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(`<tr>${cells(lines[i]).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
        i++
      }
      out.push(
        `<div class="md-tw"><table><thead><tr>${heads.join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`
      )
      continue
    }
    if (l.trim() === '') {
      i++
      continue
    }
    const buf = [l]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,4}\s|```|\s*[-*]\s|\s*\d+[.)]\s|\s*\|)/.test(lines[i])
    ) {
      buf.push(lines[i])
      i++
    }
    out.push(`<p>${inline(buf.join('<br>'))}</p>`)
  }
  return out.join('')
}

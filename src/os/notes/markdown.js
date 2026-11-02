// Markdown for notes, Obsidian-style: headings, emphasis, lists, task lists, quotes, code, [[wiki links]], #tags.
// Safety first: every piece of user text is escaped before any rule runs, so a note can never inject markup.
// Links are kept only for http and https. Pure: no DOM, no network.

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Inline formatting on text that is already escaped.
export function inline(escaped) {
  let s = escaped
  const codes = []
  s = s.replace(/`([^`\n]+)`/g, (_, c) => {
    codes.push(c)
    return `${codes.length - 1}`
  })
  s = s.replace(/\[\[([^\]\n]{1,80})\]\]/g, (_, t) => `<a class="os-nt-wiki" data-note="${t}" href="#">${t}</a>`)
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`)
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>')
  s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
  s = s.replace(/(^|\s)#([A-Za-z][\w-]{0,40})/g, '$1<span class="os-nt-tag">#$2</span>')
  s = s.replace(/\uE000(\d+)\uE000/g, (_, i) => `<code>${codes[Number(i)]}</code>`)
  return s
}

// Whole document to HTML. Returns a string that is safe to set as innerHTML.
export function render(md) {
  const lines = String(md || '').split('\n')
  const out = []
  let list = null // 'ul' | 'ol' | null
  let para = []
  let code = null // array of raw lines while inside a fence

  const closeList = () => {
    if (list) out.push(`</${list}>`)
    list = null
  }
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`)
    para = []
  }

  for (const raw of lines) {
    if (/^```/.test(raw)) {
      if (code) {
        out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`)
        code = null
      } else {
        flushPara()
        closeList()
        code = []
      }
      continue
    }
    if (code) {
      code.push(raw)
      continue
    }
    const line = esc(raw)
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    const task = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(line)
    const ul = /^\s*[-*]\s+(.*)$/.exec(line)
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    const quote = /^&gt;\s?(.*)$/.exec(line)
    if (!line.trim()) {
      flushPara()
      closeList()
    } else if (h) {
      flushPara()
      closeList()
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`)
    } else if (/^(---|\*\*\*|___)\s*$/.test(line)) {
      flushPara()
      closeList()
      out.push('<hr>')
    } else if (quote) {
      flushPara()
      closeList()
      out.push(`<blockquote>${inline(quote[1])}</blockquote>`)
    } else if (task) {
      flushPara()
      if (list !== 'ul') {
        closeList()
        out.push('<ul class="os-nt-tasks">')
        list = 'ul'
      }
      const done = task[1].toLowerCase() === 'x'
      out.push(`<li class="os-nt-task${done ? ' is-done' : ''}"><span class="os-nt-box">${done ? '✓' : ''}</span>${inline(task[2])}</li>`)
    } else if (ul) {
      flushPara()
      if (list !== 'ul') {
        closeList()
        out.push('<ul>')
        list = 'ul'
      }
      out.push(`<li>${inline(ul[1])}</li>`)
    } else if (ol) {
      flushPara()
      if (list !== 'ol') {
        closeList()
        out.push('<ol>')
        list = 'ol'
      }
      out.push(`<li>${inline(ol[1])}</li>`)
    } else {
      closeList()
      para.push(line)
    }
  }
  if (code) out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`)
  flushPara()
  closeList()
  return out.join('\n')
}

// Titles of every [[wiki link]] in a note, unique, in the order they appear.
export function wikiLinks(md) {
  const found = []
  for (const m of String(md || '').matchAll(/\[\[([^\]\n]{1,80})\]\]/g)) {
    const t = m[1].trim()
    if (t && !found.includes(t)) found.push(t)
  }
  return found
}

// Tags (#word) in a note, lowercased and unique.
export function tagsOf(md) {
  const found = []
  for (const m of String(md || '').matchAll(/(^|\s)#([A-Za-z][\w-]{0,40})/g)) {
    const t = m[2].toLowerCase()
    if (!found.includes(t)) found.push(t)
  }
  return found
}

// Notes that link to `title` with [[title]]. Matching ignores case.
export function backlinksTo(notes, title) {
  const key = title.trim().toLowerCase()
  return notes.filter((n) => wikiLinks(n.body).some((t) => t.toLowerCase() === key))
}

// A note's name: its first heading, or the first non-empty line, or "Untitled".
export function titleOf(body) {
  const first = String(body || '')
    .split('\n')
    .map((l) => l.replace(/^#+\s*/, '').trim())
    .find((l) => l)
  return first ? first.slice(0, 80) : 'Untitled'
}

export function wordCount(md) {
  const words = String(md || '').trim().split(/\s+/).filter(Boolean)
  return words.length
}

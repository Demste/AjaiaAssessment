import type { JSONContent } from '@tiptap/core'
import { DEFAULT_TITLE } from '../shared/contracts'

interface TextRun {
  text: string
  bold: boolean
  italic: boolean
}

function escapeMarkdown(text: string): string {
  return text
    .replace(/[\\\x60*_\[\](){}#!<>&|~$]/g, '\\$&')
    .replace(/^([ \t]*)([+=-])/u, '$1\\$2')
    .replace(/^([ \t]*\d{1,9})\.(?=\s|$)/u, '$1\\.')
}

function renderInline(content: JSONContent[], heading = false): string {
  const runs: (TextRun | null)[] = []
  for (const node of content) {
    if (node.type === 'hardBreak') runs.push(null)
    if (node.type !== 'text') continue

    const bold = node.marks?.some((mark) => mark.type === 'bold') ?? false
    const italic = node.marks?.some((mark) => mark.type === 'italic') ?? false
    for (const [index, text] of (node.text ?? '').split(/\r\n|\r|\n/u).entries()) {
      if (index > 0) runs.push(null)
      if (!text) continue
      const previous = runs.at(-1)
      if (previous && previous.bold === bold && previous.italic === italic) previous.text += text
      else runs.push({ text, bold, italic })
    }
  }

  return runs.map((run, index) => {
    const previous = runs[index - 1]?.text
    const next = runs[index + 1]?.text
    if (!run) return heading || !previous?.trim() || !next?.trim() ? '<br>' : '  \n'

    const parts = /^(\s*)(\S(?:.*\S)?)(\s*)$/su.exec(run.text)
    if ((!run.bold && !run.italic) || !parts) return escapeMarkdown(run.text)
    const [, leading, text, trailing] = parts
    const escaped = escapeMarkdown(text)

    // Inline tags keep emphasis boundaries unambiguous across touching runs.
    if ((!leading && previous && /\S$/u.test(previous)) || (!trailing && next && /^\S/u.test(next))) {
      const emphasis = run.italic ? `<em>${escaped}</em>` : escaped
      return leading + (run.bold ? `<strong>${emphasis}</strong>` : emphasis) + trailing
    }
    const marker = run.bold && run.italic ? '***' : run.bold ? '**' : '*'
    return leading + marker + escaped + marker + trailing
  }).join('').replace(/^[ \t]+/gm, (indent) => indent.length >= 4 || indent.includes('\t')
    ? indent.replaceAll(' ', '&#32;').replaceAll('\t', '&#9;')
    : indent)
}

function renderBlock(node: JSONContent): string {
  const content = node.content ?? []
  if (node.type === 'paragraph') return renderInline(content)
  if (node.type === 'heading') {
    return (node.attrs?.level === 2 ? '## ' : '# ') + renderInline(content, true)
  }
  if (node.type !== 'bulletList' && node.type !== 'orderedList') return ''

  const ordered = node.type === 'orderedList'
  const start = node.attrs?.start
  const firstNumber = typeof start === 'number' && Number.isInteger(start) && start >= 0 && start <= 999_999_999 ? start : 1

  return content.map((item, index) => {
    const number = firstNumber + index
    const marker = ordered ? `${number <= 999_999_999 ? number : 1}. ` : '- '
    const indent = ' '.repeat(marker.length)
    const body = (item.content ?? []).map((block) => renderBlock(block) || '<br>').join('\n\n')
    const [first, ...continuation] = body.split('\n')
    return [first ? marker + first : marker.trimEnd(), ...continuation.map((line) => line && indent + line)].join('\n')
  }).join('\n')
}

export function documentToMarkdown(document: JSONContent): string {
  const blocks = (document.content ?? []).map(renderBlock)
  if (blocks.length === 0 || (blocks.length === 1 && !blocks[0].trim())) return ''
  return blocks.map((block) => block.trim() ? block.trimEnd() : '<br>').join('\n\n') + '\n'
}

export function markdownFilename(title: string): string {
  const clean = title.normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]+/gu, '-')
    .replace(/^[\s.-]+|[\s.-]+$/gu, '')
    .replace(/\.md$/iu, '')
  // Cap Unicode names below common filesystem byte limits.
  const stem = [...clean].slice(0, 60).join('').replace(/[\s.-]+$/u, '') || DEFAULT_TITLE
  const reserved = /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9]|conin\$|conout\$)(?:\s*\.|$)/iu.test(stem)
  return `${reserved ? '_' : ''}${stem}.md`
}

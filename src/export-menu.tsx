import type { Editor } from '@tiptap/react'
import { ChevronDown, Download, FileText, Printer } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { documentToMarkdown, markdownFilename } from './markdown-export'

export function ExportMenu({ editor, title }: { editor: Editor; title: string }) {
  const menu = useRef<HTMLDetailsElement>(null)
  const trigger = useRef<HTMLElement>(null)

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      const element = menu.current
      if (element?.open && event.target instanceof Node && !element.contains(event.target)) element.open = false
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])

  function close() {
    if (menu.current) menu.current.open = false
    trigger.current?.focus()
  }

  function download() {
    close()
    const markdown = documentToMarkdown(editor.getJSON())
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = markdownFilename(title)
    document.body.append(link)
    try {
      link.click()
    } finally {
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
    }
  }

  return (
    <details ref={menu} className="export-menu" onKeyDown={(event) => {
      if (event.key === 'Escape' && event.currentTarget.open) {
        event.preventDefault()
        close()
      }
    }} onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
    }}>
      <summary ref={trigger} className="button button-secondary">
        <Download size={17} aria-hidden="true" /> Export <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <div className="export-menu-options">
        <button type="button" onClick={download}><FileText size={17} aria-hidden="true" /> Download Markdown (.md)</button>
        <button type="button" onClick={() => { close(); window.print() }}><Printer size={17} aria-hidden="true" /> Print / Save as PDF</button>
      </div>
    </details>
  )
}

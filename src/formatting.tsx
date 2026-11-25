import { useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { Bold, ChevronDown, Italic, List, ListOrdered, Underline } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

function FormatButton({ icon: Icon, label, active, onClick }: {
  icon: LucideIcon
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className="format-button" aria-label={label} title={label} aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
      <Icon size={18} aria-hidden="true" />
    </button>
  )
}

export function FormattingToolbar({ editor }: { editor: Editor }) {
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      heading1: editor.isActive('heading', { level: 1 }),
      heading2: editor.isActive('heading', { level: 2 }),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
    }),
  })

  return (
    <div className="format-toolbar" role="group" aria-label="Document formatting">
      <label className="select-wrap text-style">
        <select aria-label="Text style" value={active.heading1 ? '1' : active.heading2 ? '2' : 'paragraph'}
          onChange={(event) => {
            const value = event.target.value
            const command = editor.chain().focus()
            if (value === 'paragraph') command.setParagraph().run()
            else command.setHeading({ level: value === '1' ? 1 : 2 }).run()
          }}>
          <option value="paragraph">Normal text</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
        </select>
        <ChevronDown size={15} aria-hidden="true" />
      </label>
      <span className="toolbar-divider" />
      <FormatButton icon={Bold} label="Bold" active={active.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
      <FormatButton icon={Italic} label="Italic" active={active.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <FormatButton icon={Underline} label="Underline" active={active.underline} onClick={() => editor.chain().focus().toggleUnderline().run()} />
      <span className="toolbar-divider" />
      <FormatButton icon={List} label="Bulleted list" active={active.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <FormatButton icon={ListOrdered} label="Numbered list" active={active.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
    </div>
  )
}

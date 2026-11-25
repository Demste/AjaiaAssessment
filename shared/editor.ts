import StarterKit from '@tiptap/starter-kit'

export const editorExtensions = [
  StarterKit.configure({
    blockquote: false,
    code: false,
    codeBlock: false,
    heading: { levels: [1, 2] },
    horizontalRule: false,
    link: false,
    strike: false,
    trailingNode: false,
  }),
]

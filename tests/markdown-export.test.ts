import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { documentToMarkdown, markdownFilename } from '../src/markdown-export'

const document = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })
const paragraph = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content })
const heading = (level: number, ...content: JSONContent[]): JSONContent => ({
  type: 'heading', attrs: { level }, content,
})
const text = (value: string, ...marks: string[]): JSONContent => ({
  type: 'text', text: value, marks: marks.map((type) => ({ type })),
})
const item = (...content: JSONContent[]): JSONContent => ({ type: 'listItem', content })
const hardBreak: JSONContent = { type: 'hardBreak' }

describe('Markdown document export', () => {
  it('keeps headings and emphasis while retaining underlined text as plain text', () => {
    const content = document(
      heading(1, text('Roadmap')),
      heading(2, text('Week one')),
      paragraph(
        text('Bold', 'bold'), text(' '), text('italic', 'italic'), text(' '),
        text('both', 'bold', 'italic'), text(' '), text('underline', 'underline'), text(' '),
        text('still bold', 'bold', 'underline'),
      ),
    )

    expect(documentToMarkdown(content)).toBe(
      '# Roadmap\n\n## Week one\n\n**Bold** *italic* ***both*** underline **still bold**\n',
    )
  })

  it('keeps adjacent emphasis runs distinct inside a word', () => {
    const content = document(paragraph(text('pre'), text('bold', 'bold'), text('italic', 'italic'), text('.')))
    expect(documentToMarkdown(content)).toBe('pre<strong>bold</strong><em>italic</em>.\n')
  })

  it('preserves paragraph boundaries, hard breaks, and literal line endings', () => {
    const content = document(
      paragraph(text('First'), hardBreak, text('Second\r\nThird')),
      paragraph(),
      heading(2, text('One'), hardBreak, text('Two')),
      paragraph(text('Before'), hardBreak, hardBreak, text('After'), hardBreak),
    )
    expect(documentToMarkdown(content)).toBe(
      'First  \nSecond  \nThird\n\n<br>\n\n## One<br>Two\n\nBefore<br><br>After<br>\n',
    )
  })

  it('preserves nested lists, ordered starts, and wrapped item text', () => {
    const content = document(
      {
        type: 'bulletList',
        content: [
          item(paragraph(text('First')), {
            type: 'orderedList', attrs: { start: 3 },
            content: [
              item(paragraph(text('Inner')), { type: 'bulletList', content: [item(paragraph(text('Deep')))] }),
              item(paragraph(text('Next'))),
            ],
          }, paragraph(text('Follow-up'))),
          item(paragraph(text('Second'))),
        ],
      },
      {
        type: 'orderedList', attrs: { start: 9 },
        content: [item(paragraph(text('Nine'))), item(paragraph(text('Ten'), hardBreak, text('Continuation')))],
      },
    )

    expect(documentToMarkdown(content)).toBe(
      '- First\n\n  3. Inner\n\n     - Deep\n  4. Next\n\n  Follow-up\n- Second\n\n9. Nine\n10. Ten  \n    Continuation\n',
    )
  })

  it('escapes literal block markers, inline markup, HTML, and backslashes', () => {
    const content = document(
      paragraph(text('# Header')), paragraph(text('1. Item')), paragraph(text('- Dash')),
      paragraph(text('---')), paragraph(text('*bold* _italic_ [link](url) <tag> &copy; \\')),
      paragraph(text('    Indented')),
    )

    expect(documentToMarkdown(content)).toBe([
      '\\# Header', '1\\. Item', '\\- Dash', '\\---',
      '\\*bold\\* \\_italic\\_ \\[link\\]\\(url\\) \\<tag\\> \\&copy; \\\\',
      '&#32;&#32;&#32;&#32;Indented',
    ].join('\n\n') + '\n')
  })

  it('returns an empty string for an empty document', () => {
    expect(documentToMarkdown(document())).toBe('')
    expect(documentToMarkdown(document(paragraph()))).toBe('')
    expect(documentToMarkdown(document(paragraph(text('   '))))).toBe('')
  })
})

describe('Markdown filenames', () => {
  it.each([
    [' ../Quarterly: review?.md ', 'Quarterly- review.md'],
    ['CON.txt', '_CON.txt.md'],
    ['LPT¹', '_LPT1.md'],
    ['重 要', '重 要.md'],
    [' ... / * ', 'Untitled document.md'],
  ])('sanitizes %s to %s', (title, expected) => {
    expect(markdownFilename(title)).toBe(expected)
  })

  it('caps the filename without splitting Unicode characters', () => {
    expect(markdownFilename('📄'.repeat(80))).toBe('📄'.repeat(60) + '.md')
  })
})

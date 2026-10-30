// CodeMirror 6 setup. Loaded lazily by CodeApp, so the desktop shell never pays for it.
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, syntaxHighlighting, HighlightStyle, indentOnInput } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { search, searchKeymap } from '@codemirror/search'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { tags } from '@lezer/highlight'

const voidTheme = EditorView.theme(
  {
    '&': { color: '#ecebe6', backgroundColor: '#0b0b0d', height: '100%', fontSize: '13px' },
    '.cm-content': { caretColor: '#ccff00', fontFamily: "'IBM Plex Mono', ui-monospace, monospace", padding: '10px 0' },
    '.cm-cursor': { borderLeftColor: '#ccff00' },
    '.cm-scroller': { fontFamily: "'IBM Plex Mono', ui-monospace, monospace", lineHeight: '1.6' },
    '.cm-gutters': { backgroundColor: '#0b0b0d', color: '#5c5c64', border: 'none' },
    '.cm-activeLine': { backgroundColor: 'rgba(204,255,0,0.035)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#9a9aa2' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(204,255,0,0.18) !important' },
    '.cm-matchingBracket': { color: '#ccff00', backgroundColor: 'rgba(204,255,0,0.12)' },
    '.cm-panels': { backgroundColor: '#131316', color: '#ecebe6' },
    '.cm-panels input, .cm-panels button': { fontFamily: 'inherit' },
    '.cm-searchMatch': { backgroundColor: 'rgba(204,255,0,0.22)' },
    '.cm-tooltip': { backgroundColor: '#131316', border: '1px solid rgba(204,255,0,0.16)' },
  },
  { dark: true },
)

const voidHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#c792ea' },
  { tag: [tags.string, tags.special(tags.string)], color: '#c3e88d' },
  { tag: [tags.number, tags.bool, tags.null], color: '#f78c6c' },
  { tag: tags.comment, color: '#5c6370', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#82aaff' },
  { tag: [tags.propertyName], color: '#89ddff' },
  { tag: [tags.typeName, tags.className], color: '#ffcb6b' },
  { tag: [tags.operator, tags.punctuation], color: '#89ddff' },
  { tag: tags.heading, color: '#ccff00', fontWeight: 'bold' },
  { tag: tags.link, color: '#82aaff', textDecoration: 'underline' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
])

export function languageExtension(lang) {
  if (lang === 'js') return javascript({ jsx: false, typescript: false })
  if (lang === 'json') return json()
  if (lang === 'md') return markdown()
  return []
}

// One state per open file, so undo history survives tab switches.
export function makeState(doc, lang, { onSave, onRun, onChange }) {
  return EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      drawSelection(),
      history(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      search({ top: true }),
      EditorState.tabSize.of(2),
      keymap.of([
        { key: 'Mod-s', run: () => (onSave(), true) },
        { key: 'Mod-Enter', run: () => (onRun(), true) },
        indentWithTab,
        ...closeBracketsKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...defaultKeymap,
      ]),
      languageExtension(lang),
      voidTheme,
      syntaxHighlighting(voidHighlight),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onChange()
      }),
    ],
  })
}

export function makeView(parent, state) {
  return new EditorView({ parent, state })
}

export function cursorOf(state) {
  const head = state.selection.main.head
  const line = state.doc.lineAt(head)
  return { line: line.number, col: head - line.from + 1 }
}

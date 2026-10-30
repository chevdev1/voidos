# VOID.CODE: a minimal code editor for the VOID.OS desktop

Written for: the team building the desktop. Scope is a minimal editor, not a VS Code replacement. It lives inside the VOID.OS demo as one window, and should feel familiar to anyone who has used VS Code.

## 1. Goals

- Let a developer open a small project, edit JavaScript, JSON and Markdown, and run JavaScript safely.
- Look and feel like VS Code at a glance: activity bar, explorer, tabs, editor, bottom panel, status bar.
- Stay small. No extensions, no git, no language servers, no real file system. Everything runs in the browser.
- Fit the product story: a developer tool that never asks for keys, and warns when someone pastes one.

## 2. Non-goals (for this version)

- Real files on disk, git, extensions, debugging, language servers, remote development.
- Multi-user editing. Documents are local.
- A full terminal. The panel runs a small fixed set of commands.

## 3. What the user gets

| Area | v1 behavior |
|---|---|
| Activity bar | Explorer, Search (filters the file list), Run, Settings. Clicking toggles the sidebar panel. |
| Explorer | Demo project `void-lab`: `README.md`, `package.json`, `src/index.js`, `src/market.js`, `src/format.js`. Click to open. Reset button restores the demo. |
| Tabs | Open files as tabs. Dirty files show a dot. Close with the ×, middle click or `Ctrl+W`. |
| Editor | CodeMirror 6. Line numbers, bracket matching, auto-close brackets, undo and redo, search (`Ctrl+F`), JavaScript, JSON and Markdown highlighting. |
| Save | `Ctrl+S` writes to `localStorage` for this device. The status bar shows "saved". |
| Run | `Ctrl+Enter` or the Run button runs the active `.js` file in a sandbox (see section 5). Output goes to the bottom panel. |
| Terminal panel | Commands: `help`, `ls`, `cat <file>`, `run <file>`, `clear`. Toggle with `` Ctrl+` ``. |
| Command palette | `Ctrl+Shift+P`. Actions: Save, Run file, Reset project, Toggle terminal, Toggle sidebar. |
| Status bar | Branch `main` (demo label), line and column, language, "saved" or "unsaved", and the sandbox state. |
| Secret guard | On save, if the text looks like a private key or a seed phrase, a banner warns the user and asks them to remove it. Saving still works, because the file never leaves the device. |

## 4. Architecture

```
src/os/code/
  CodeApp.jsx       layout: activity bar, sidebar, tabs, editor host, panel, status bar
  editor.js         CodeMirror 6 setup and the VOID theme (loaded lazily)
  files.js          demo project, load/save to localStorage, language by extension, tree helpers
  runner.js         runs JavaScript in a Web Worker with a timeout and captured console
  secrets.js        pure check for key-like and seed-like text (no network, no storage)
  palette.js        command list and filter (pure)
  terminal.js       command parser for the panel (pure, returns lines)
```

Pure modules (`files.js` helpers, `secrets.js`, `palette.js`, `terminal.js`) have no DOM access, so they are covered by `node --test`.

### 4.1 Loading and bundle size

- CodeMirror is imported with a dynamic `import()` the first time the Code window opens. The landing and the desktop shell never load it.
- Packages: `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/lang-javascript`, `@codemirror/lang-json`, `@codemirror/lang-markdown`, `@lezer/highlight`.
- Target: the Code chunk stays under 200 KB gzip. Check with the build output.

### 4.2 State

One reducer in `CodeApp.jsx`:

- `files`: map of path to text, loaded from `localStorage` (`void-code-files`) or the demo.
- `open`: ordered list of open paths, plus `active`.
- `dirty`: set of paths with unsaved changes.
- `sidebar`: `'explorer' | 'search' | null`.
- `panel`: boolean, and `output` lines for the terminal and run results.

Editor content is the source of truth while typing. The reducer only receives "text changed" and "saved" events, so typing does not re-render the whole window on every key.

## 5. Running code safely

Running user code in the page would give it access to the page's wallet provider, storage and DOM. So:

1. Each run starts a **Web Worker** created from a Blob. Workers have no `window`, no `document`, no `localStorage` and no `window.ethereum`.
2. The worker evaluates the code with `console.log`, `console.error` and `console.warn` captured. Each captured call becomes one output line.
3. A **timeout of 2 seconds** terminates the worker. Infinite loops cannot freeze the desktop.
4. The worker's result is a list of lines plus the last value, or an error with line information when possible.

What the sandbox does **not** stop: network requests (`fetch` is available in workers). That is documented in the UI as "network is allowed in sandbox". A future version can add a restricted build of the worker without `fetch`.

## 6. Keyboard

| Key | Action |
|---|---|
| `Ctrl/Cmd+S` | Save |
| `Ctrl/Cmd+Enter` | Run active file |
| `Ctrl/Cmd+Shift+P` | Command palette |
| `` Ctrl/Cmd+` `` | Toggle terminal panel |
| `Ctrl/Cmd+B` | Toggle sidebar |
| `Ctrl/Cmd+W` | Close tab |
| `Ctrl/Cmd+F` | Find in file (CodeMirror) |

## 7. Accessibility and motion

- Every icon button has an `aria-label`. Tabs use `role="tab"`, the panel uses `role="log"` with `aria-live="polite"`.
- The editor keeps CodeMirror's keyboard model. Focus returns to the editor after palette and panel actions.
- Motion follows the desktop settings: the panel slide-in and tab underline are disabled when Motion is off or reduced-motion is set.

## 8. Testing

- `node --test` for `files.js`, `secrets.js`, `palette.js` and `terminal.js`. These cover load and save fallback, language detection, key detection (valid and false positives), palette filtering, and terminal command parsing.
- Runner: the timeout and output capture are checked in the browser with a scripted run (an infinite loop must end in under 3 seconds and report a timeout).
- Browser smoke: open Code, open a file, type, save, run, check the panel output.

## 9. Known limits (v1)

- One device only. Files live in this browser's storage. Clearing site data removes them.
- No undo across sessions.
- Sandbox allows network access (see section 5).
- Syntax highlighting covers JavaScript, JSON and Markdown only.
- The secret guard is a heuristic. It catches common formats, not every secret.

## 10. Next steps after v1

1. Export and import of the project as a single JSON file.
2. A restricted sandbox without network access, as the default.
3. Split editor and a second panel for the output.
4. Real files through the native build, with explicit permission each time.

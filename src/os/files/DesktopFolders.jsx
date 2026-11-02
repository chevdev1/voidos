import { FilesIcon } from '../icons.jsx'

// Two folders on the desktop itself. Opening one shows its contents in the Files app.
const DESKTOP_FOLDERS = [
  { name: 'Documents', grad: ['#9ccfff', '#3b74c9'] },
  { name: 'Projects', grad: ['#ccff00', '#7fb300'] },
]

export function DesktopFolders({ onOpen }) {
  return (
    <div className="os-desk-folders" aria-label="Desktop folders">
      {DESKTOP_FOLDERS.map((f) => (
        <button
          key={f.name}
          className="os-desk-folder"
          onDoubleClick={() => onOpen('files', { path: [f.name], nonce: Date.now() })}
          onKeyDown={(e) => e.key === 'Enter' && onOpen('files', { path: [f.name], nonce: Date.now() })}
          aria-label={`Open ${f.name} folder`}
        >
          <span className="os-desk-folder-tile" style={{ '--g1': f.grad[0], '--g2': f.grad[1] }} aria-hidden="true">
            <FilesIcon width={30} height={30} />
          </span>
          <span className="os-desk-folder-name">{f.name}</span>
        </button>
      ))}
    </div>
  )
}

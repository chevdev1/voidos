import '../legacy/void.css'

/**
 * Drawer opened by voidEngine.js when a sector/grain is clicked on the
 * cosmos canvas. Content is written imperatively via getElementById — this
 * component only renders the shell + ids the engine expects.
 */
export function SectorTerminal() {
  return (
    <aside className="void term" id="term">
      <button className="x" id="termX">
        ✕
      </button>
      <h3 id="termTitle">SECTOR #000</h3>
      <div className="sub" id="termSub">
        —
      </div>
      <div className="trow">
        <span className="k">status</span>
        <span id="tStatus">—</span>
      </div>
      <div className="trow">
        <span className="k">orbit ring</span>
        <span id="tRing">—</span>
      </div>
      <div className="trow">
        <span className="k">price</span>
        <span className="v hot" id="tPrice">
          —
        </span>
      </div>
      <div className="trow">
        <span className="k">size</span>
        <span id="tSize">—</span>
      </div>
      <div className="trow">
        <span className="k">gravity</span>
        <span id="tGrav">—</span>
      </div>
      <div className="note" id="tNote">
        Closer to core → higher burn. Outer rim is cheap chaos.
      </div>
      <button className="btn-lime" id="termBuy">
        connect · claim
      </button>
    </aside>
  )
}

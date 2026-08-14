import '../legacy/void.css'

/**
 * Drawer + multi-constellation stack dock. Content filled by voidEngine via ids.
 */
export function SectorTerminal() {
  return (
    <>
      <aside className="void term" id="term">
        <button className="x" id="termX" type="button">
          ✕
        </button>
        <h3 id="termTitle">CONSTEL · —</h3>
        <div className="sub" id="termSub">
          —
        </div>
        <div className="trow">
          <span className="k">status</span>
          <span id="tStatus">—</span>
        </div>
        <div className="trow">
          <span className="k">lot type</span>
          <span id="tRing">—</span>
        </div>
        <div className="trow">
          <span className="k">stars linked</span>
          <span id="tTier">—</span>
        </div>
        <div className="trow">
          <span className="k">price</span>
          <span className="v hot" id="tPrice">
            —
          </span>
        </div>
        <div className="trow">
          <span className="k">mass</span>
          <span id="tSize">—</span>
        </div>
        <div className="trow">
          <span className="k">owned</span>
          <span id="tGrav">—</span>
        </div>
        <div className="note" id="tNote">
          Tap constellations to stack several. Claim stack buys every selected lot at once.
        </div>
        <button className="btn-ghost-term" id="termAdd" type="button" hidden>
          + add grain
        </button>
        <button className="btn-ghost-term" id="termAddConstel" type="button">
          + add constellation to stack
        </button>
        <button className="btn-lime" id="termBuy" type="button">
          claim constellation · test
        </button>
      </aside>

      <div className="cart-dock" id="cartDock" hidden>
        <div className="cart-head">
          <b id="cartTitle">STACK · 0 constellations</b>
          <button type="button" id="cartClear" className="cart-clear">
            clear
          </button>
        </div>
        <div className="cart-list" id="cartList" />
        <div className="cart-totals">
          <span>
            mass <b id="cartMass">0</b> cells
          </span>
          <span>
            burn <b id="cartBurn">—</b>
          </span>
        </div>
        <button type="button" className="btn-lime cart-claim" id="cartClaim">
          claim all · burn $TEST
        </button>
      </div>
    </>
  )
}

import '../legacy/void.css'

/**
 * Drawer + multi-grain stack dock. Content filled by voidEngine via ids.
 */
export function SectorTerminal() {
  return (
    <>
      <aside className="void term" id="term">
        <button className="x" id="termX" type="button">
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
          <span className="k">size tier</span>
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
          <span className="k">gravity</span>
          <span id="tGrav">—</span>
        </div>
        <div className="note" id="tNote">
          Closer to core → higher burn. Bigger grains → more cells. Shift+click stacks several.
        </div>
        <button className="btn-ghost-term" id="termAdd" type="button">
          + add to stack
        </button>
        <button className="btn-lime" id="termBuy" type="button">
          connect · claim this
        </button>
      </aside>

      <div className="cart-dock" id="cartDock" hidden>
        <div className="cart-head">
          <b id="cartTitle">STACK · 0</b>
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
            burn <b id="cartBurn">$0.00</b>
          </span>
        </div>
        <button type="button" className="btn-lime cart-claim" id="cartClaim">
          claim stack
        </button>
      </div>
    </>
  )
}

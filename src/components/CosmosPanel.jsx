import '../legacy/void.css'

/**
 * Single cosmos shell — the canvas engine mounts by these ids.
 * Lives in the hero slot by default; "View full map" relocates the same
 * DOM node into the arena stage (one engine, two homes).
 */
export function CosmosPanel() {
  return (
    <div className="hero-right" id="cosmosFrame">
      <div className="cosmos-bar">
        <b>◎ COSMOS</b>
        <span id="cosmosHint">click map to explore · shift+click stack · wheel zooms while exploring</span>
        <button type="button" className="cosmos-explore" id="cosmosExploreBtn">
          Explore
        </button>
      </div>
      <canvas id="cosmos" />
      <div className="cosmos-fx" aria-hidden="true" />
      <div className="cosmos-scan" aria-hidden="true" />
      <div className="cosmos-hud">
        <div className="tag">THE VOID · EXOMIND</div>
        <div className="pill">
          <div className="lab">✦ burned forever</div>
          <div className="num" id="burned">
            7,218,018
          </div>
          <div className="sub">$EXO · 0.72% of supply · 1,000,000,000 ever minted</div>
        </div>
        <div className="zoom-lvl">
          view · <b id="zoomLabel">EXOMIND</b>
        </div>
      </div>
      <div className="tip" id="tip">
        <div className="t1" id="tip1">
          sector #0
        </div>
        <div className="t2" id="tip2">
          —
        </div>
      </div>
      <div className="vc">
        <button id="searchBtn" type="button" title="find grain #">
          ⌕
        </button>
        <button id="zoomIn" type="button" title="zoom in">
          +
        </button>
        <button id="zoomOut" type="button" title="zoom out">
          −
        </button>
        <button id="homeBtn" type="button" title="reset">
          ⌂
        </button>
        <button id="orbitBtn" type="button" className="on" title="orbit 360°">
          ⊕
        </button>
        <button id="spinBtn" type="button" className="on" title="auto spin">
          ⟳
        </button>
      </div>
      <div className="filters" id="filters">
        <span className="fchip on" data-f="empty">
          <i className="box" />
          empty
        </span>
        <span className="fchip on" data-f="claimed">
          <i className="box" />
          claimed
        </span>
        <span className="fchip on" data-f="fed">
          <i className="box" />
          fed
        </span>
        <span className="fchip on" data-f="core">
          <i className="box" />
          core
        </span>
        <span className="fchip" data-f="heat">
          <i className="box" />
          heat
        </span>
        <span className="fchip on" data-f="yours">
          <i className="box" />
          yours <b id="yoursCnt">0</b>
        </span>
      </div>
      <div className="minimap">
        <canvas id="mini" width="240" height="170" />
        <div className="cap" id="miniCap">
          0 grains · map
        </div>
      </div>
    </div>
  )
}

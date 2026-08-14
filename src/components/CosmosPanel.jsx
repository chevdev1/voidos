import '../legacy/void.css'
import '../legacy/phoneMap.css'

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
            0
          </div>
          <div className="sub">$TEST · 1B supply · Robinhood Chain</div>
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
      <div className="mind-bar" id="mindBar">
        <div className="mind-dock-row">
          <button type="button" className="mind-dock-toggle" id="mindDockToggle" aria-expanded="false">
            tools
          </button>
          <button type="button" className="mind-btn mind-btn--ask-compact" data-act="ask" id="actAskCompact">
            <span className="ico">◉</span> ask me
          </button>
        </div>
        <div className="mind-legend" id="mindLegend">
          <span className="mind-leg" data-f="empty">
            <i className="box empty" />
            free <b id="cntEmpty">0</b>
          </span>
          <span className="mind-leg" data-f="claimed">
            <i className="box claimed" />
            others <b id="cntClaimed">0</b>
          </span>
          <span className="mind-leg" data-f="fed">
            <i className="box fed" />
            trained <b id="cntFed">0</b>
          </span>
          <span className="mind-leg" data-f="yours">
            <i className="box yours" />
            yours <b id="yoursCnt">0</b>
          </span>
        </div>
        <div className="mind-sep" aria-hidden="true" />
        <div className="mind-actions" id="mindActions">
          <button type="button" className="mind-btn" data-act="heat" id="actHeat">
            <span className="ico">⚡</span> heat
          </button>
          <button type="button" className="mind-btn" data-act="standings" id="actStandings">
            <span className="ico">☆</span> standings
          </button>
          <button type="button" className="mind-btn" data-act="market" id="actMarket">
            <span className="ico">⛓</span> market
          </button>
          <button type="button" className="mind-btn" data-act="what" id="actWhat">
            <span className="ico">💬</span> what i am
          </button>
          <button type="button" className="mind-btn" data-act="personality" id="actPersonality">
            <span className="ico">▣</span> personality
          </button>
          <button type="button" className="mind-btn" data-act="ask" id="actAsk">
            <span className="ico">◉</span> ask me
          </button>
        </div>
      </div>
      <div className="mind-meta" id="mindMeta">
        <span id="mindMetaLine">loading live ledger…</span>
        <span id="mindMetaBurn">connect wallet · live ledger</span>
      </div>
      <div className="mind-panel" id="mindPanel" hidden>
        <div className="mind-panel-card" role="dialog" aria-modal="true">
          <div className="mind-panel-top">
            <span className="mind-panel-title" id="mindPanelTitle">
              —
            </span>
            <button type="button" className="mind-panel-x" id="mindPanelX" aria-label="close">
              ✕
            </button>
          </div>
          <div className="mind-panel-body" id="mindPanelBody" />
        </div>
      </div>
      <div className="filters" id="filters" hidden aria-hidden="true">
        {/* kept for engine wiring / legacy chips — UI is mind-bar */}
        <span className="fchip on" data-f="empty" />
        <span className="fchip on" data-f="claimed" />
        <span className="fchip on" data-f="fed" />
        <span className="fchip on" data-f="core" />
        <span className="fchip" data-f="heat" />
        <span className="fchip on" data-f="yours" />
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

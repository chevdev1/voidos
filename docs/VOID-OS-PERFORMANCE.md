# VOID.OS performance: budgets, measurements and the plan

Written for: the team. Goal: the desktop responds to every input at once, never stalls, and does not spend battery or network on things nobody can see. This is a plan with measured baselines and honest notes on what is and is not verified yet.

## 1. Budgets

Targets for a mid-range laptop (4 cores, 8 GB, integrated graphics), Chrome current stable:

| What | Budget | Why |
|---|---|---|
| Input to next frame (pointer, click, key) | under 16 ms, p95 | Anything slower is felt as lag |
| Long tasks on the main thread (over 50 ms) | zero while a user interacts | A long task blocks input |
| Frame time while dragging or resizing a window | under 8 ms of script | Drags must stay at 60 fps |
| Opening a window | under 100 ms to first paint of content | Feels instant |
| First usable desktop after `/os` loads | under 3 s on mid-range hardware | The story starts here |
| JS on first load of `/os` | under 300 KB gzip (excluding the editor and wallet libraries, which load on demand) | First paint speed |
| Background work in a hidden tab | none | Battery and network |

## 2. How we measure

- **Long tasks.** `os/perf.js` counts main-thread tasks over 50 ms. Enable with `?perf=1` in the address. Results live on `window.__perf`.
- **Scripted interaction.** Puppeteer drives the desktop: drag a window 60 steps, resize from each edge, open and close apps. Read the counters before and after.
- **Bundle.** `vite build` prints the gzip size of every chunk. Track `OsDemo` and `index` on each release.
- **Frame time.** Chrome DevTools Performance panel, recorded during a drag. Not yet automated.

### Measured so far (honest)

- Drag, 60 steps, before the change: 3 long tasks, longest 85 ms, in one run.
- Drag, 60 steps, after the change (direct DOM movement): 5 to 56 long tasks across three runs, longest 128 to 179 ms.

**These numbers do not show an improvement, and they are too noisy to conclude anything.** The spread between runs (5 to 56) is larger than any change we made. The likely cause is this sandbox: other browser and server processes share the CPU, and the galaxy engine runs a continuous animation loop on the same thread. A valid measurement needs a quiet machine, several runs, and a median. Until then, no performance claim is made in this document.

What the code change does guarantee, independent of measurement: while a window moves or resizes, React does not re-render the desktop on each pointer move. Position changes are written to the element's style directly, and state is written once on release. This is verified by the geometry tests and by the resize scenario, which lands on the right coordinates from every direction.

## 3. Where the time goes (ranked by likely cost)

1. **The galaxy engine.** A canvas with tens of thousands of grains and a continuous animation loop. It is the single heaviest thing on the screen. Off by default on devices with 4 cores or fewer, or 4 GB RAM or less.
2. **Re-rendering the desktop.** Every state change in the window reducer re-renders `OsDemo` and all windows. Windows moved, focused, minimized or resized all go through it.
3. **Polling.** Pulse polls the chain every 2.5 s. Market and trending fetch once per session with a cache. The gateway health check runs on each browser start page.
4. **The player's clock.** Emits about four updates a second while a file plays. Only the player re-renders, but the state object is shared.
5. **Dock magnification.** Runs on pointer move, computed from layout, and writes 14 transforms. Cheap, but it runs at pointer rate.
6. **Terminal and code output.** Logs are capped (300 lines in VOID.CODE, 40 lines per `cat`). The terminal keeps all lines in state; a long session grows without a cap.

## 4. Done in this round

- **Direct-DOM drag and resize** (`WindowFrame.jsx`). No state writes during movement. Verified by tests and a scripted resize.
- **Geometry in its own module** (`geometry.js`). Pure, tested for every edge, every corner, the minimum size and the screen bounds (6 tests).
- **Performance watch** (`perf.js`). Off by default, `?perf=1` to enable.
- **Hidden-tab pause for block polling** (`Pulse.jsx`). Requests stop while the tab is hidden.

## 5. Plan, in order of value

1. **A stable measurement.** Run each scripted scenario five times, take the median, and record the machine. Add a script `scripts/os-perf.mjs` that prints the medians. Without this, every other item is a guess.
2. **Split the window reducer.** Keep window geometry out of the global store. Give each window its own small store, so moving or focusing one window does not re-render the others. Expected: fewer renders per interaction.
3. **Memoize windows.** Wrap `WindowFrame` and the app components in `React.memo` once their props are stable (the callbacks need to be stable first: `useCallback` in `OsDemo`).
4. **Throttle the player clock.** Emit elapsed time once a second, not on every `timeupdate`, unless the player window is open.
5. **Cap the terminal log.** Keep the last 500 lines, and drop the rest from state.
6. **Galaxy: pause when covered.** When a maximized window covers most of the screen, pause the galaxy loop and resume on restore. This needs a hook into the legacy engine (`voidEngine.js`), so it is a deliberate change, not a quick one.
7. **Bundle review.** Confirm the editor and the wallet libraries are only loaded when their windows open. Check that `OsDemo` stays under the budget.

## 6. What we will not do

- No premature micro-optimization of code that is not on a measured hot path.
- No removal of visual features to hit a number. If the galaxy has to go, it goes behind the wallpaper switch the user already has.
- No claim of a speedup without a median over several runs on a quiet machine.

## 7. Open questions

- Which machine is the reference for "mid-range"? Pick one and keep it for every measurement.
- Do we ship the perf watch in production, or keep it behind `?perf=1` only? Current choice: only behind the flag.

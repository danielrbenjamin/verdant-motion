export const demoLayout = /* HTML */ `
  <div class="shell">
    <header class="app-header">
      <a class="brand" href="./"
        ><span class="mark">v.</span>verdant<span class="light">motion</span></a
      ><a
        class="source-link"
        href="https://github.com/dgreenheck/ez-tree"
        target="_blank"
        rel="noreferrer"
        >Built on EZ Tree ↗</a
      >
    </header>
    <main class="viewport" aria-label="Interactive tree preview">
      <div id="view"></div>
      <div class="scene-tag">
        <h1 id="scene-title">Oak Large</h1>
      </div>
      <div class="viewport-hint">Drag to orbit <span>·</span> Scroll to zoom</div>
      <span id="fps" class="fps">— FPS</span>
    </main>
    <aside class="sidebar" aria-label="Tree controls">
      <div class="panel-heading">
        <div>
          <h2>Tree settings</h2>
        </div>
        <button id="reset" class="icon-button" title="Reset lifecycle" aria-label="Reset lifecycle">
          ↺
        </button>
      </div>
      <section class="control-section">
        <label class="control" for="preset"
          ><span>Species</span
          ><select id="preset"></select></label
        ><label class="control" for="seed"
          ><span>Generation seed</span>
          <div class="seedrow">
            <input id="seed" type="number" value="42" min="1" max="999999" /><button
              id="random"
              title="Randomize seed"
              aria-label="Randomize seed"
            >
              ↻
            </button>
          </div></label
        >
      </section>
      <section class="control-section">
        <div class="section-label">Season <span class="meta" id="season-name">SUMMER</span></div>
        <div class="range-control">
          <label for="season">Annual cycle <output id="season-out">50%</output></label
          ><input
            id="season"
            class="season-range"
            type="range"
            min="0"
            max="1"
            step="any"
            value="0.5"
          />
          <div class="ticks">
            <span>Winter</span><span>Spring</span><span>Summer</span><span>Autumn</span>
          </div>
        </div>
      </section>
      <section class="control-section">
        <label class="check"
          ><span>Procedural growth</span><input type="checkbox" id="procedural-growth" checked
        /></label>
        <div class="range-control">
          <label for="growth">Maturity <output id="growth-out">100%</output></label
          ><input id="growth" type="range" min="0" max="1" step="any" value="1" />
        </div>
        <div class="growth-actions">
          <button id="grow" class="grow-button">▶ Grow from seedling</button
          ><label class="duration" title="Growth duration"
            ><input
              id="growth-duration"
              aria-label="Growth duration in seconds"
              type="number"
              min="1"
              max="120"
              value="12"
            /><span>sec</span></label
          >
        </div>
      </section>
      <details class="control-section">
        <summary>Wind & health</summary>
        <div class="details-content">
          <div class="range-control">
            <label for="health">Health <output id="health-out">100%</output></label
            ><input id="health" type="range" min="0" max="1" step="0.001" value="1" />
          </div>
          <div class="range-control">
            <label for="wind">Wind <output id="wind-out">25%</output></label
            ><input id="wind" type="range" min="0" max="1" step="0.001" value="0.25" />
          </div>
        </div>
      </details>
      <details class="control-section">
        <summary>Grass & flowers</summary>
        <div class="details-content">
          <label class="check"><span>Meadow grass</span><input type="checkbox" id="grass" /></label>
          <div class="range-control">
            <label for="grass-count">Density <output id="grass-count-out">6,500</output></label
            ><input id="grass-count" type="range" min="500" max="12000" step="100" value="6500" />
          </div>
          <div class="range-control">
            <label for="grass-size">Scale <output id="grass-size-out">100%</output></label
            ><input id="grass-size" type="range" min="0.25" max="3" step="0.05" value="1" />
          </div>
          <label class="check"
            ><span>Wildflowers</span><input type="checkbox" id="flowers"
          /></label>
          <div class="range-control">
            <label for="flower-count">Density <output id="flower-count-out">260</output></label
            ><input id="flower-count" type="range" min="10" max="1000" step="10" value="260" />
          </div>
          <div class="range-control">
            <label for="flower-size">Scale <output id="flower-size-out">100%</output></label
            ><input id="flower-size" type="range" min="0.25" max="3" step="0.05" value="1" />
          </div>
        </div>
      </details>
    </aside>
    <div class="transport" role="group" aria-label="Season playback">
      <button id="play" class="primary">▶ &nbsp; Play seasons</button
      ><span class="transport-divider"></span
      ><button id="reverse" title="Reverse season playback">↶ &nbsp; Reverse</button
      ><span class="transport-label">ANNUAL CYCLE <span>18 SEC</span></span>
    </div>
  </div>
`;

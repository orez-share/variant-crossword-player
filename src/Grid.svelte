<script>
  let { gridObj, cursor } = $props();
  export const focus = () => { gridRef.focus() };

  let grid = $derived(gridObj.grid);
  // TODO: this probably isn't sufficient for Weird Grids.
  // consider some failsafes
  const renderWidth = gridObj.width * 3;
  const renderHeight = gridObj.height * 3;

  const viewportWidth = gridObj.width;
  const viewportHeight = gridObj.height;

  const gridCellContentPx = 32;
  const gridCellBorderPx = gridCellContentPx + 1;

  let drag = null;
  let scroll = $state({x: 0, y: 0});

  let gridRef = $state();

  // XXX:
  // I guess Grid.svelte ought to handle a custom enum of semantic events,
  // like "left" and "delete" and "add letter(A)" rather than keypresses.
  // Then keypresses and focus and other DOM-y crap can be managed
  // by +page.svelte or whatever.
  //
  // I don't want to do that right now though.
  const handleKey = evt => {
    switch (evt.keyCode) {
      case 37: // <
        evt.preventDefault();
        if (cursor.axis === "down" && !evt.shiftKey) cursor.axis = "across";
        else cursor.jumpLeft();
        break;
      case 38: // ^
        evt.preventDefault();
        if (cursor.axis === "across" && !evt.shiftKey) cursor.axis = "down";
        else cursor.jumpUp();
        break;
      case 39: // >
        evt.preventDefault();
        if (cursor.axis === "down" && !evt.shiftKey) cursor.axis = "across";
        else cursor.jumpRight();
        break;
      case 40: // v
        evt.preventDefault();
        if (cursor.axis === "across" && !evt.shiftKey) cursor.axis = "down";
        else cursor.jumpDown();
        break;
      case 8: // bksp
        // this is a little complicated.
        // - if there's anything in your cell, delete the last chr and don't move
        // - otherwise, move back a cell and delete the last chr
        //   - UNLESS moving back jumps a wall, in which case just chill
        let idx = cursor.idx;
        if (!grid[idx].fill.length) {
          if (!cursor.moveBack()) {
            cursor.prevWord();
            cursor.setSelected({idx: cursor.line.last});
            break;
          }
          idx = cursor.idx;
        }
        grid[idx].fill = grid[idx].fill.slice(0, -1);
        break;
      case 9: // tab
        evt.preventDefault();
        // unconditionally step one word, then seek until you find an open cell
        if (evt.shiftKey) {
          cursor.prevWord();
          cursor.backToUnfilled();
        } else {
          cursor.nextWord();
          cursor.aheadToUnfilled();
        }
        break;
      case 32: // space
        cursor.toggleAxis();
        break;
      default:
        if (evt.ctrlKey || evt.altKey || evt.metaKey) return;
        if (evt.keyCode > 64 && evt.keyCode < 91) {
          const chr = String.fromCharCode(evt.keyCode);
          const idx = cursor.idx;
          if (grid[idx].wall) return;
          // if there's not space, replace the fill
          // if there's space, add the letter
          grid[idx].fill = (gridObj.cellFilled(idx) ? "" : grid[idx].fill) + chr;

          if (!cursor.nextOpenCellInWord()) cursor.aheadToUnfilled();
        }
    }
  };

  // ===
  // Scroll methods

  const handleDragClick = (evt) => {
    drag = {x: evt.x - scroll.x, y: evt.y - scroll.y};
    return false;
  }

  const handleDragScroll = (evt) => {
    if (drag) {
      scroll.x = evt.x - drag.x;
      scroll.y = evt.y - drag.y;
      recenterScroll()
    }
    return false;
  }

  const handleDragDrop = (evt) => {
    drag = null;
    // snap to closest cell
    // TODO: quick animation could be fun polish
    scroll.x = Math.round(scroll.x / gridCellBorderPx) * gridCellBorderPx;
    scroll.y = Math.round(scroll.y / gridCellBorderPx) * gridCellBorderPx;
    return false;
  }

  // this feels super jank but we'll seeee
  const recenterScroll = () => {
    for (let i = 0; i < 3; i++) {
      if (scroll.x > 0) {
        const w = gridCellBorderPx * gridObj.width;
        const h = gridCellBorderPx * -gridObj.tessellation.y;
        drag.x += w;
        drag.y += h;
        scroll.x -= w;
        scroll.y -= h;
      }
      if (scroll.y > 0) {
        const w = gridCellBorderPx * -gridObj.tessellation.x
        const h = gridCellBorderPx * gridObj.height;
        drag.x += w;
        drag.y += h;
        scroll.x -= w;
        scroll.y -= h;
      }
      if (scroll.x < (renderWidth - viewportWidth) * -gridCellBorderPx) {
        const w = gridCellBorderPx * -gridObj.width;
        const h = gridCellBorderPx * gridObj.tessellation.y;
        drag.x += w;
        drag.y += h;
        scroll.x -= w;
        scroll.y -= h;
      }
      if (scroll.y < (renderHeight - viewportHeight) * -gridCellBorderPx) {
        const w = gridCellBorderPx * gridObj.tessellation.x
        const h = gridCellBorderPx * -gridObj.height;
        drag.x += w;
        drag.y += h;
        scroll.x -= w;
        scroll.y -= h;
      }
    }
  }
</script>

<svelte:window
  onmouseup={handleDragDrop}
/>
<div id="grid-wrapper"
  onmousedown={handleDragClick}
  onmousemove={handleDragScroll}
  style="
    width: {gridCellBorderPx * viewportWidth + 1}px;
    height: {gridCellBorderPx * viewportHeight + 1}px;
  "
>
  <div id="grid"
    tabindex="0"
    style="
      grid-template-columns: repeat({renderWidth}, 1fr);
      left: {scroll.x}px;
      top: {scroll.y}px;
    "
    onkeydown={handleKey}
    oncontextmenu={evt => evt.preventDefault()}
    bind:this={gridRef}
  >
    {#each {length: renderHeight} as _, y }
      {#each {length: renderWidth} as _, x }
        {@const idx = gridObj.localCoord({x, y}).idx}
        {@const cell = grid[idx]}
        <div class="cell"
          class:selected-line={cursor.line && cursor.line.cells.has(idx)}
          class:selected={cursor.idx === idx}
          class:wall={cell.wall}
          onmousedown={evt => {
            if (evt.buttons === 0 || evt.buttons === 1) {
              if (idx === cursor.idx) cursor.toggleAxis();
              // We're safe to send `idx` here, because it's guaranteed
              // to be in the local tessellation.
              else cursor.setSelected({idx});
            }
          }}
        >
          {#if cell.number}
            <span class="cell-number">{cell.number}</span>
          {/if}
          <span class="cell-fill">{cell.fill}</span>
        </div>
      {/each}
    {/each}
  </div>
</div>

<style>
  #grid-wrapper {
    position: relative;
    overflow: hidden;
  }

  #grid {
    position: absolute;
    display: grid;
    background-color: #111;
    grid-gap: 1px;
    padding: 1px;
  }

  .cell {
    background-color: white;
    width: 2em;
    height: 2em;
    text-align: center;
    font-family: "DejaVu Sans Mono", monospace;
    user-select: none;
    position: relative;
  }

  #grid:focus .selected.wall {
    background-color: #550;
  }

  #grid:focus .selected {
    background-color: yellow;
  }

  .selected.selected-line.wall {
    background-color: #441;
  }

  .selected.selected-line {
    background-color: #cc6;
  }

  .selected-line.wall {
    background-color: #234;
  }

  .selected-line {
    background-color: #ace;
  }

  .wall {
    background-color: #111;
  }

  .cell-number {
    font-size: 0.5em;
    left: 1px;
    top: 1px;
    position: absolute;
  }

  .cell-fill {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 2px;
    margin-left: auto;
    margin-right: auto;
  }
</style>

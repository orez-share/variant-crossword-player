<script>
  import { leftOf, upOf, rightOf, downOf } from './directions';

  let { gridObj, cursor, cursorMethods } = $props();
  export const focus = () => { gridRef.focus() };
  const {
    setSelected,
    face,
    toggleFace,
    prevWord,
    nextWord,
  } = cursorMethods;

  const biffLimit = 1000;
  const cellFillLen = 1; // !?
  let grid = $derived(gridObj.grid);
  // TODO: this probably isn't sufficient for Weird Grids.
  // consider some failsafes
  const renderWidth = gridObj.width * 3;
  const renderHeight = gridObj.height * 3;

  const viewportWidth = gridObj.width;
  const viewportHeight = gridObj.height;

  const gridCellContentPx = 32;
  const gridCellBorderPx = gridCellContentPx + 1;

  let undos = [];
  let redos = [];

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
        if (cursor.axis === "down" && !evt.shiftKey) face("across");
        else jump(leftOf);
        break;
      case 38: // ^
        evt.preventDefault();
        if (cursor.axis === "across" && !evt.shiftKey) face("down");
        else jump(upOf);
        break;
      case 39: // >
        evt.preventDefault();
        if (cursor.axis === "down" && !evt.shiftKey) face("across");
        else jump(rightOf);
        break;
      case 40: // v
        evt.preventDefault();
        if (cursor.axis === "across" && !evt.shiftKey) face("down");
        else jump(downOf);
        break;
      case 8: // bksp
        // this is a little complicated.
        // - if there's anything in your cell, delete the last chr and don't move
        // - otherwise, move back a cell and delete the last chr
        //   - UNLESS moving back jumps a wall, in which case just chill
        let idx = cursor.idx;
        if (!grid[idx].fill.length) {
          if (!moveBack()) {
            prevWord();
            setSelected({idx: cursor.line.last});
            break;
          }
          idx = cursor.idx;
        }
        const fill = grid[idx].fill.slice(0, -1);
        performAction("Delete cell contents", [{idx, is: {fill}}]);
        break;
      case 9: // tab
        evt.preventDefault();
        if (evt.shiftKey) {
          prevWord();
          backToUnfilled();
        } else {
          nextWord();
          aheadToUnfilled();
        }
        break;
      case 32: // space
        toggleFace();
        break;
      default:
        // if (evt.ctrlKey || evt.metaKey) {
        //   switch (evt.keyCode) {
        //     case 90: // Z
        //       if (evt.shiftKey) {
        //         redo();
        //       } else {
        //         undo();
        //       }
        //       break;
        //   }
        // }
        if (evt.ctrlKey || evt.altKey || evt.metaKey) return;
        if (evt.keyCode > 64 && evt.keyCode < 91) {
          const chr = String.fromCharCode(evt.keyCode);
          const idx = cursor.idx;
          if (grid[idx].wall) return;
          // if there's not space, replace the fill
          // if there's space, add the letter
          let fill = (cellFilled(idx) ? "" : grid[idx].fill) + chr;
          performAction("Type character", [{idx, is: {fill}}]);

          const start = 0;
          if (!nextOpenCellInWord()) aheadToUnfilled();
        }
    }
  };

  const cellFilled = (idx) => grid[idx].fill.length >= cellFillLen;

  // Find the next open cell in the current word.
  // Start at the current position: if you hit the end of the line,
  // go back to the front of the line and continue. If you hit your
  // starting position, return false.
  const nextOpenCellInWord = () => {
    const first = cursor.line.first;
    const start = cursor.idx;
    do {
      if (!cellFilled(cursor.idx)) return true;
      if (!moveAhead()) setSelected({idx: first});
    } while(start !== cursor.idx)
    return false;
  }

  const backToUnfilled = () => {
    // go to the next non-full cell in the word
    let oops = 0;
    while (cellFilled(cursor.idx)) {
      // note that we still `moveAhead`: we walk forward within a word,
      // even as we walk backward in the grid.
      if (!moveAhead()) {
        prevWord();
      }
      if (oops++ > biffLimit) throw new Error("you biffed it");
    }
  }

  const aheadToUnfilled = () => {
    // go to the next non-full cell in the word
    let oops = 0;
    while (cellFilled(cursor.idx)) {
      if (!moveAhead()) {
        nextWord();
      }
      if (oops++ > biffLimit) throw new Error("you biffed it");
    }
  }

  // Apply `step` fn to the cursor position until you find a nonwall cell,
  // and move the cursor there. Used for the arrow keys.
  const jump = (step) => {
    let oops = 0;
    let pos = cursor;
    let cell;
    do {
      pos = step(pos);
      pos = gridObj.localCoord(pos);
      cell = gridObj.grid[pos.idx];
      if (oops++ > biffLimit) throw new Error("you biffed it");
    } while (cell.wall)
    setSelected({idx: pos.idx});
  }

  // Move the cursor one step in the given direction, unless this would move
  // the cursor into a wall. Returns `false` in this case, `true` otherwise.
  const moveLeft = () => setSelected(leftOf(cursor));
  const moveUp = () => setSelected(upOf(cursor));
  const moveRight = () => setSelected(rightOf(cursor));
  const moveDown = () => setSelected(downOf(cursor));

  const moveAhead = () => cursor.axis === "across" ? moveRight() : moveDown();
  const moveBack = () => cursor.axis === "across" ? moveLeft() : moveUp();

  // ===

  const performAction = (action, updates) => {
    for (let update of updates) {
      const keys = Object.keys(update.is);
      update.was = Object.fromEntries(keys.map(key => [key, grid[update.idx][key]]));
      grid[update.idx] = {...grid[update.idx], ...update.is};
    }

    undos.push({action, updates});
    undos = undos;
    redos = [];
  }

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
              if (idx === cursor.idx) toggleFace();
              // We're safe to send `idx` here, because it's guaranteed
              // to be in the local tessellation.
              else setSelected({idx});
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

  .clue label {
    display: block;
  }

  .flex-container {
    display: flex;
  }

  .fill-width {
    flex: 1;
  }

  button {
    margin-bottom: 10px;
  }
</style>

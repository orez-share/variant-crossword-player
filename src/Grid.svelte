<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import Grid from "./grid";

  const cellFillLen = 1; // !?
  const gridObj = new Grid({
    width: 13,
    height: 13,
    tessellation: { x: 3, y: 2 },
  });
  $: grid = gridObj.grid;
  $: width = gridObj.width;
  $: height = gridObj.height;

  let undos = [];
  let redos = [];

  // TODO
  const hardcodedWalls = [
    6, 7, 11, 17, 18, 25, 26, 30, 35, 40, 41, 42, 59,
    63, 70, 77, 78, 82, 86, 90, 110, 114, 120, 124, 131,
    132, 133, 134, 139, 145, 156, 162, 166
  ];
  for (const idx of hardcodedWalls) {
    gridObj.grid[idx].wall = true;
  }

  let cursor = { x: 0, y: 0, axis: "across" };

  let gridRef;

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
        if (cursor.axis === "down") face("across");
        else moveLeft();
        break;
      case 38: // ^
        evt.preventDefault();
        if (cursor.axis === "across") face("down");
        else moveUp();
        break;
      case 39: // >
        evt.preventDefault();
        if (cursor.axis === "down") face("across");
        else moveRight();
        break;
      case 40: // v
        evt.preventDefault();
        if (cursor.axis === "across") face("down");
        else moveDown();
        break;
      case 8: // bksp
        // this is a little complicated.
        // - if there's anything in your cell, delete the last chr and don't move
        // - otherwise, move back a cell and delete the last chr
        //   - "move back a cell" can jump walls
        let idx = cursor.idx;
        if (!grid[idx].fill.length) {
          moveBack();
          idx = cursor.idx;
        }
        const fill = grid[idx].fill.slice(0, -1);
        performAction("Delete cell contents", [{idx, is: {fill}}]);
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
          advanceToUnfilled();
        }
    }
  };

  const cellFilled = (idx) => grid[idx].fill.length >= cellFillLen;

  const advanceToUnfilled = () => {
    // - go to the next non-full cell in the word,
    // - go to the next word NUMERICALLY
    // - loop
    let oops = 0;
    while (cellFilled(cursor.idx)) {
      oops++;
      if (!moveAhead()) {
        nextWord(); return;
        break;
      }
      if (oops > 1000) throw new Error("you biffed it");
    }
  }

  // TODO: would be nice if we could just update the global coordinate,
  // and then translate that back into the Origin Utah.

  const moveLeft = () => {
    if (cursor.x > 0) {
      // no loop
      return setSelected({x: cursor.x - 1, y: cursor.y});
    } else if (cursor.y < gridObj.tessellation.y) {
      // loop into C
      return setSelected({
        x: gridObj.innerWidth-1,
        y: gridObj.innerHeight + cursor.y,
      });
    } else {
      // loop into B
      return setSelected({
        x: gridObj.width - 1,
        y: cursor.y - gridObj.tessellation.y,
      });
    }
  }

  const moveUp = () => {
    if (cursor.y > 0) {
      return setSelected({x: cursor.x, y: cursor.y - 1});
    } else if (cursor.x < gridObj.tessellation.x) {
      // loop into B
      return setSelected({
        x: cursor.x + gridObj.innerWidth,
        y: gridObj.innerHeight-1,
      });
    } else {
      // loop into C
      return setSelected({
        x: cursor.x - gridObj.tessellation.x,
        y: gridObj.height - 1,
      });
    }
  }

  const moveRight = () => {
    if (cursor.x < width-1) {
      return setSelected({x: cursor.x + 1, y: cursor.y});
    } else {
      return setSelected({x: 0, y: cursor.y + gridObj.tessellation.y});
    }
  }

  const moveDown = () => {
    if (cursor.y < height-1) {
      return setSelected({x: cursor.x, y: cursor.y + 1});
    } else {
      return setSelected({x: cursor.x + gridObj.tessellation.x, y: 0});
    }
  }

  const moveAhead = () => {
    if (cursor.axis === "across") return moveRight();
    else return moveDown();
  }

  const moveBack = () => {
    if (cursor.axis === "across") return moveLeft();
    else return moveUp();
  }

  const nextWord = () => {
    console.log("aight go to the next word");
  }

  const face = (axis) => {
    cursor.axis = axis;
    cursor.line = gridObj.lineAt(cursor);
  }

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

  // Accepts {x, y} xor {idx}, and returns all three.
  const normalizeCoordFmt = ({x, y, idx}) => {
    const hasX = x != null;
    const hasY = y != null;
    const hasIdx = idx != null;
    if (hasX && hasY && !hasIdx) {
      return {x, y, idx: y * width + x};
    }
    if (!hasX && !hasY && hasIdx) {
      // TODO: negatives
      return {
        x: idx % width,
        y: Math.floor(idx / width),
        idx,
      }
    }
    throw new Error("expected {x, y} xor {idx}");
  }

  const setSelected = (coord) => {
    let { x, y, idx } = normalizeCoordFmt(coord);
    // coord = normalizeCoordFmt(coord);
    // let { x, y, idx } = gridObj.normalizeTessellatedCoord(coord);
    if (idx < 0 || idx >= width * height) {
      console.warn({idx});
      return false;
    }
    const redirect = grid[idx].redirect;
    if (redirect != null) {
      ({x, y, idx} = normalizeCoordFmt({ idx: redirect }));
    }
    if (grid[idx].wall) return false;

    cursor.x = x;
    cursor.y = y;
    cursor.idx = idx;
    cursor.line = gridObj.lineAt(cursor);
    return true;
  }

  // onMount(async () => {
  //   await init();
  // });
</script>

<!-- <svelte:window
  on:mouseup={() => selected && (selected.state = null)}
/> -->
<div id="grid-wrapper">
  <div id="grid"
    tabindex="0"
    style="grid-template-columns: repeat({width}, 1fr)"
    on:keydown={handleKey}
    on:contextmenu={evt => evt.preventDefault()}
    bind:this={gridRef}
  >
    {#each {length: height} as _, rawY }
      {#each {length: width} as _, rawX }
        {@const rawIdx = width * rawY + rawX}
        {@const rawCell = grid[rawIdx]}
        {@const redirect = rawCell.redirect != null}

        {@const cell = redirect ? grid[rawCell.redirect] : rawCell}
        {@const idx = redirect ? rawCell.redirect : rawIdx}

        {@const isSelected = cursor.idx === idx}
        <div class="cell"
          class:selected-line={cursor.line && cursor.line.cells.has(idx)}
          class:selected={isSelected}
          class:wall={cell.wall}
          on:mousedown={evt => {
            if (evt.buttons === 1) {
              setSelected({idx});
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
    display: flex;
    flex-direction: column;
  }

  #grid {
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

  .preview {
    color: darkgray;
  }

  .clue label {
    display: block;
  }

  .meta {
    display: inline-block;
    width: 400px;
    margin-right: 10px;
  }

  .flex-container {
    display: flex;
  }

  .fill-width {
    flex: 1;
  }

  .header {
    display: flex;
    margin-bottom: 10px;
    width: 661px; /* TODO: don't */
    flex-wrap: wrap;
  }

  .push {
    margin-left: auto;
  }

  input.title {
    font-size: 1.5em;
    display: block;
    margin-bottom: 5px;
  }

  button {
    margin-bottom: 10px;
  }
</style>

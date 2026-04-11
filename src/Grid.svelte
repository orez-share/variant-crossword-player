<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { leftOf, upOf, rightOf, downOf } from './directions';
  import Grid from "./grid";

  const cellFillLen = 1; // !?
  const viewportWidth = 20;
  const viewportHeight = 20;
  const gridObj = new Grid({
    width: 13,
    height: 13,
    tessellation: { x: 1, y: 1 },
  });
  $: grid = gridObj.grid;
  $: width = gridObj.width;
  $: height = gridObj.height;

  let undos = [];
  let redos = [];

  // number each cell while we're debugging this wacky thing
  let idx = 1;
  for (const elem of gridObj.grid) {
    elem.number = idx;
    idx++;
  }

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
        // TODO: holding shift
        if (cursor.axis === "down" && !evt.shiftKey) face("across");
        else moveLeft();
        break;
      case 38: // ^
        evt.preventDefault();
        if (cursor.axis === "across" && !evt.shiftKey) face("down");
        else moveUp();
        break;
      case 39: // >
        evt.preventDefault();
        if (cursor.axis === "down" && !evt.shiftKey) face("across");
        else moveRight();
        break;
      case 40: // v
        evt.preventDefault();
        if (cursor.axis === "across" && !evt.shiftKey) face("down");
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
      case 9: // tab
        evt.preventDefault();
        if (evt.shiftKey) {
          // oof
        } else {
          nextWord();
          advanceToUnfilled();
        }
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
    // go to the next non-full cell in the word,
    // loop {
    //   restart the word and try again
    //   go to the next word NUMERICALLY
    // }
    // let pos = ({x, y} => ({x, y}))(cursor);
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

  const moveLeft = () => setSelected(leftOf(cursor));
  const moveUp = () => setSelected(upOf(cursor));
  const moveRight = () => setSelected(rightOf(cursor));
  const moveDown = () => setSelected(downOf(cursor));

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

  const toggleFace = () => {
    cursor.axis = cursor.axis === "across" ? "down" : "across";
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

  const setSelected = (coord) => {
    let { x, y, idx } = gridObj.localCoord(coord);
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
    style="grid-template-columns: repeat({viewportWidth}, 1fr)"
    on:keydown={handleKey}
    on:contextmenu={evt => evt.preventDefault()}
    bind:this={gridRef}
  >
    {#each {length: viewportHeight} as _, y }
      {#each {length: viewportWidth} as _, x }
        {@const idx = gridObj.localCoord({x, y}).idx}
        {@const cell = grid[idx]}

        {@const isSelected = cursor.idx === idx}
        <div class="cell"
          class:selected-line={cursor.line && cursor.line.cells.has(idx)}
          class:selected={isSelected}
          class:wall={cell.wall}
          on:mousedown={evt => {
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

<script>
  import { onMount } from 'svelte';
  import Clues from '../Clues.svelte';
  import Grid from '../Grid.svelte';
  import { clues, gridObj } from "../puz";

  let gridRef = $state();

  let cursor = $state({ x: 0, y: 0, idx: 0, axis: "across" });
  let selectedClue = $derived(cursor.line && clues[cursor.axis].find(([num, _]) => cursor.line.number === num)?.[1]);

  const setSelected = (coord) => {
    let { x, y, idx } = gridObj.localCoord(coord);
    if (gridObj.grid[idx].wall) return false;

    cursor.x = x;
    cursor.y = y;
    cursor.idx = idx;
    cursor.line = gridObj.lineAt(cursor);
    return true;
  }

  const face = (axis) => {
    cursor.axis = axis;
    cursor.line = gridObj.lineAt(cursor);
  }

  const toggleFace = () => {
    cursor.axis = cursor.axis === "across" ? "down" : "across";
    cursor.line = gridObj.lineAt(cursor);
  }

  const prevWord = () => {
    const [num, idx] = gridObj.prevWordFrom({ number: cursor.line.number, axis: cursor.axis });
    setSelected({idx});
  }

  const nextWord = () => {
    const [num, idx] = gridObj.nextWordFrom({ number: cursor.line.number, axis: cursor.axis });
    setSelected({idx});
  }

  // when you click a clue,
  // - it takes you to the next letter to solve in that clue
  //   - unless it's full, in which case you go to the first letter
  // - regardless of if you're already in that clue or not
  const focusClue = (axis, number) => {
    const idx = gridObj.locationOfNum(number);
    cursor.axis = axis;
    setSelected({idx});
    // TODO: advance
    gridRef.focus();
  };

  const cursorMethods = {
    setSelected,
    face,
    toggleFace,
    prevWord,
    nextWord,
  };

  onMount(() => {
    // Start at the first across
    focusClue("across", clues.across[0][0]);
    gridRef.focus();
  })
</script>

<svelte:head>
  <title>Variant Crossword Player</title>
</svelte:head>

<div id="body-wrapper">
  <div style="grid-area: clue" class="selected-clue">
    {#if cursor.line}
      <strong>{cursor.line.number}{cursor.axis === "across"?"A":"D"}</strong>
      {selectedClue}
    {/if}
  </div>
  <div style="grid-area: grid">
    <Grid {gridObj} {cursor} {cursorMethods} bind:this={gridRef} />
  </div>
  <div style="grid-area: across">
    <Clues
      axis="across"
      clues={clues.across}
      selected={cursor.axis === "across" ? cursor.line?.number : null}
      onClick={num => focusClue("across", num)} />
  </div>
  <div style="grid-area: down">
    <Clues
      axis="down"
      clues={clues.down}
      selected={cursor.axis === "down" ? cursor.line?.number : null}
      onClick={num => focusClue("down", num)} />
  </div>
</div>

<style>
  :global(body) {
    font-family: Helvetica;
  }

  #body-wrapper {
    display: grid;
    grid-template-areas: "clue across down ."
                         "grid across down .";
    grid-template-columns: auto auto auto 1fr;
    grid-template-rows: auto 1fr;
    grid-gap: 10px;
  }

  .selected-clue {
    background-color: lightblue;
    padding: 16px;
  }

  .selected-clue strong {
    margin-right: 8px;
  }
</style>

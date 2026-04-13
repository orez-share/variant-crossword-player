<script>
  import { onMount } from 'svelte';
  import Clues from '../Clues.svelte';
  import Grid from '../Grid.svelte';
  import { clues, gridObj } from "../puz";

  let gridRef;

  let cursor = { x: 0, y: 0, idx: 0, num: 1, axis: "across" };

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
  <Grid {gridObj} {cursor} {cursorMethods} bind:this={gridRef} />
  <Clues
    axis="across"
    clues={clues.across}
    selected={cursor.axis === "across" ? cursor.line?.number : null}
    onClick={num => focusClue("across", num)} />
  <Clues
    axis="down"
    clues={clues.down}
    selected={cursor.axis === "down" ? cursor.line?.number : null}
    onClick={num => focusClue("down", num)} />
</div>

<style>
  #body-wrapper {
    display: grid;
    grid-template-columns: auto 1fr 1fr;
    grid-gap: 10px;
  }
</style>

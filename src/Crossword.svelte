<script>
  import { onMount } from 'svelte';
  import Clues from './Clues.svelte';
  import Grid from './Grid.svelte';
  import Meta from './Meta.svelte';
  import Cursor from './cursor.svelte.js';

  let { meta, viewport, gridObj, clues, variants } = $props();

  // TODO: I'm not sure this needs to be a $state?
  let gridRef = $state();

  let cursor = $state(new Cursor(gridObj));
  // Start at the first across
  cursor.focusClue("across", clues.across[0][0]);
  let selectedClue = $derived(cursor.line && clues[cursor.axis].find(([num, _]) => cursor.line.number === num)?.[1]);

  const focusClue = (axis, number) => {
    cursor.focusClue(axis, number);
    // is this weird? i think this is weird.
    // TODO: rethink how focus works
    gridRef.focus();
  };

  const clueProps = (axis) => {
    return {
      axis,
      clues: clues[axis],
      selected: cursor.axis === axis ? cursor.line?.number : null,
      onClick: (num => focusClue(axis, num)),
    }
  }

  onMount(async () => {
    gridRef.focus();
  })
</script>

<Meta {...meta} />
<div class="crossword">
  <div style="grid-area: clue" class="selected-clue">
    <div class="clue-flex">
      {#if cursor.line}
        <strong>{cursor.line.number}{cursor.axis === "across"?"A":"D"}</strong>
        <span>{selectedClue}</span>
      {/if}
    </div>
  </div>
  <div style="grid-area: grid">
    <Grid {gridObj} {cursor} {viewport} {variants} bind:this={gridRef} />
  </div>
  <div style="grid-area: across">
    <Clues {...clueProps("across")} />
  </div>
  <div style="grid-area: down">
    <Clues {...clueProps("down")} />
  </div>
</div>

<style>
  .crossword {
    display: grid;
    grid-template-areas: "clue across down ."
                         "grid across down .";
    grid-template-columns: auto auto auto 1fr;
    grid-template-rows: auto 1fr;
    grid-gap: 10px;
  }

  .selected-clue {
    background-color: lightblue;
    padding: 0 1em;
    display: block;
    box-sizing: border-box;
    height: 3.5em;
    align-content: center;
    overflow-y: scroll;
    /* Trick to prevent child from stretching parent
    https://stackoverflow.com/a/57599409 */
    width: 0;
    min-width: 100%;
  }

  /* `.selected-clue` needs to be `display: block` for `align-content: center`,
  but we want a flexbox to keep the clue text from flowing over the number.
  */
  .clue-flex {
    display: flex;
  }

  .selected-clue strong {
    margin-right: 8px;
  }
</style>

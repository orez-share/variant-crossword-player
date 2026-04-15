<script>
  import { onMount } from 'svelte';
  import Crossword from '../Crossword.svelte';
  import { loadPuz } from '../loadPuz.js';

  let puzzle = $state();

  onMount(async () => {
    const response = await fetch("./Tessel1-prototype.ipuz");
    const ipuz = await response.json();
    puzzle = loadPuz(ipuz);
  })
</script>

<svelte:head>
  <title>Variant Crossword Player</title>
</svelte:head>

<div id="body-wrapper">
  {#if puzzle }<Crossword {...puzzle} />{/if}
</div>

<style>
  :global(body) {
    font-family: Helvetica;
  }
</style>

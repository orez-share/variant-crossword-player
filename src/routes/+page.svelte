<script>
  import { onMount } from 'svelte';
  import Crossword from '../Crossword.svelte';
  import { loadPuz } from '../loadPuz.js';

  let puzzle = $state();
  let error = $state();

  const loadPuzFromHashRoute = async () => {
    const filename = window.location.hash.replace(/^#\//, "");
    if (/[^\w-]/.test(filename)) {
      error = "Invalid filename";
      return;
    }
    const response = await fetch(`../puz/${filename}.ipuz`);
    if (!response.ok) {
      error = `Error loading puzzle ${filename} (${response.statusText})`;
      return;
    }
    const ipuz = await response.json();
    puzzle = loadPuz(ipuz);
  }

  onMount(async () => {
    await loadPuzFromHashRoute();
  })
</script>

<svelte:head>
  <title>Variant Crossword Player</title>
</svelte:head>

<div id="body-wrapper">
  {#if error }{ error }{/if}
  {#if puzzle }<Crossword {...puzzle} />{/if}
</div>

<style>
  :global(body) {
    font-family: Helvetica;
  }
</style>

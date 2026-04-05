<script>
  import { onMount } from 'svelte';
  import Grid from '../Grid.svelte';
</script>

<svelte:head>
  <title>Variant Crossword Player</title>
</svelte:head>

<div id="body-wrapper">
  <Grid />
</div>

<style>
  #body-wrapper {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-gap: 10px;
  }
</style>

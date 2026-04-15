<script>
  import { run } from 'svelte/legacy';

  import { onMount } from 'svelte';

  let {
    clues,
    axis,
    selected,
    onClick
  } = $props();
  let doc;

  const scrollToClue = (num) => {
    if (!doc) return;
    const el = doc.getElementById(`${axis}-${num}`);
    if (!el) return;
    el.scrollIntoView({block: "center"});
  };
  run(() => {
    scrollToClue(selected);
  });

  onMount(() => {
    doc = document; // svelte sucks
  });
</script>

<div class="panel">
  <h3>{axis}</h3>
  <ul>
    {#each clues as [num, clue] }
      <li
        id={`${axis}-${num}`}
        onclick={() => onClick(num)}
        class:selected={num === selected}
      >
        <strong>{num}</strong><span>{clue}</span>
      </li>
    {/each}
  </ul>
</div>

<style>
  .panel {
    background-color: lightyellow;
    width: 250px;
    padding: 10px;
    box-sizing: border-box;
    height: 530px; /* TODO: css sucks */
    display: flex;
    flex-direction: column;
  }

  h3 {
    margin: 0;
    border-bottom: 1px solid lightgray;
    padding-bottom: 5px;
  }

  ul {
    list-style-type: none;
    padding-left: 0;
    margin: 0;
    overflow-y: scroll;
    height: 100%;
  }

  li {
    padding: 5px;
    user-select: none;
    cursor: pointer;
    display: flex;
  }

  li.selected {
    background-color: lightblue;
  }

  strong {
    margin-right: 8px;
  }
</style>

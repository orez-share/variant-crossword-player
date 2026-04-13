<script>
  export let clues;
  export let axis;
  export let selected;

  export let onClick;
  // TODO: scroll down to the `selected` when `selected` changes
</script>

<div class="panel">
  <h3>{axis}</h3>
  <ul>
    {#each clues as [num, clue] }
      <li
        on:click={() => onClick(num)}
        class:selected={num === selected}
      >
        <strong>{num}</strong> {clue}
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
    height: 430px; /*TODO*/
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
  }

  li.selected {
    background-color: lightblue;
  }

  strong {
    margin-right: 8px;
  }
</style>

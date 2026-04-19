<script>
  const { title, author, copyright, notes } = $props();

  // TODO: really oughtta display `notes` and `copyright` somewhere..
  // buuuut this tool's just for my personal xwords currently, and _I_
  // haven't been populating those fields, soooooooo...
</script>

<div class="container">
  <div class="title">{title}</div>
  <div class="author">by {author}</div>
</div>

<style>
  .container {
    margin-bottom: 10px;
  }

  .title {
    font-size: 20pt;
    font-weight: bold;
    margin-bottom: 0;
  }

  .author {
    font-size: 14pt;
    margin-top: 0.5em;
  }
</style>

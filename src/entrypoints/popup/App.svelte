<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from 'wxt/browser';

  let key = '';
  let status = 'No key yet.';

  function keyOf(value: unknown): string {
    if (typeof value === 'object' && value !== null && 'key' in value && typeof value.key === 'string') {
      return value.key;
    }
    return '';
  }

  onMount(async () => {
    const stored = keyOf(await browser.runtime.sendMessage({ type: 'read-key' }));
    key = stored;
    status = stored ? 'Saved.' : 'No key yet.';
  });

  async function save() {
    const stored = keyOf(await browser.runtime.sendMessage({ type: 'write-key', key }));
    status = stored ? 'Saved.' : 'No key yet.';
  }
</script>

<main>
  <h1>Jevly</h1>
  <label>
    API key
    <input type="password" bind:value={key} autocomplete="off" />
  </label>
  <button type="button" on:click={save}>Save</button>
  <p class="status">{status}</p>
  <p class="fixed">Three questions ship with the extension. Audience, directness, ready to send.</p>
</main>

<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from 'wxt/browser';
  import { readKeyState } from '../../lib/messages';

  let key = '';
  let status = 'No key yet.';

  function showKey(value: unknown) {
    const stored = readKeyState(value);
    if (!stored) {
      status = 'The key could not be read.';
      return;
    }
    key = stored.key;
    status = stored.key ? 'Saved.' : 'No key yet.';
  }

  onMount(async () => {
    showKey(await browser.runtime.sendMessage({ type: 'read-key' }));
  });

  async function save() {
    showKey(await browser.runtime.sendMessage({ type: 'write-key', key }));
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

<script lang="ts">
  import type { Readable } from "svelte/store";
  import type { Verdict } from "../../lib/verdict";

  type View = {
    badgeOn: boolean;
    cardOpen: boolean;
    sheetOpen: boolean;
    verdict: Verdict | null;
    badgeTop: string;
    badgeRight: string;
    cardTop: string;
    cardRight: string;
    sheetTop: string;
    sheetRight: string;
  };

  let {
    view,
    onBadge,
    onAnyway,
    onBack,
  }: {
    view: Readable<View>;
    onBadge: () => void;
    onAnyway: () => void;
    onBack: () => void;
  } = $props();

  function fails(verdict: Verdict | null) {
    if (!verdict || verdict.status !== "ready") return [];
    return verdict.rows.filter((row) => row.fail);
  }
</script>

<button
  type="button"
  class="badge"
  class:on={$view.badgeOn}
  style:top={$view.badgeTop}
  style:right={$view.badgeRight}
  style:left="auto"
  onclick={onBadge}
>
  <span class="kicker">jev</span>
  <span class="word">
    {#if $view.verdict?.status === "ready" && $view.verdict.clear}
      <svg class="check" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.2 8.4 6.4 11.6 12.8 4.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    {/if}
    {#if !$view.verdict}
      …
    {:else if $view.verdict.status === "missing-key"}
      key
    {:else if $view.verdict.status === "error"}
      offline
    {:else}
      {$view.verdict.badge}
    {/if}
  </span>
</button>

<div
  class="card"
  class:on={$view.cardOpen}
  style:top={$view.cardTop}
  style:right={$view.cardRight}
  style:left="auto"
>
  <h2>This draft</h2>
  {#if !$view.verdict || $view.verdict.status !== "ready"}
    <p class="note">
      {$view.verdict?.status === "error"
        ? "The check did not run. Send is open."
        : "Add an API key in the Jevly popup."}
    </p>
  {:else}
    <p class="hint">Probability of the answer shown.</p>
    {#each $view.verdict.rows as row}
      <div class="row" class:bad={row.fail}>
        <div class="top">
          <span class="label">{row.label}</span>
          <span class:fail={row.fail}>{row.value}</span>
          <span class="prob">{row.p.toFixed(2)}</span>
        </div>
        {#if row.kind === "score"}
          <div class="scale">
            {#each row.levels as level, index}
              <span class:on={index === row.at}>{level}</span>
            {/each}
          </div>
        {:else}
          <div class="meter"><span style:width="{Math.max(0, Math.min(1, row.p)) * 100}%"></span></div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<div
  class="sheet"
  class:on={$view.sheetOpen}
  role="dialog"
  aria-label="Send check"
  style:top={$view.sheetTop}
  style:right={$view.sheetRight}
  style:left="auto"
>
  {#if $view.verdict?.status === "ready"}
    {@const blocked = fails($view.verdict)}
    <h2>{blocked.length === 1 ? "1 check would block this send." : `${blocked.length} checks would block this send.`}</h2>
    {#each blocked as row}
      <div class="row bad">
        <div class="top">
          <span class="label">{row.label}</span>
          <span class="fail">{row.value}</span>
          <span class="prob">{row.p.toFixed(2)}</span>
        </div>
        {#if row.kind !== "score"}
          <div class="meter"><span style:width="{Math.max(0, Math.min(1, row.p)) * 100}%"></span></div>
        {/if}
      </div>
    {/each}
    <button type="button" class="anyway" onclick={onAnyway}>Send anyway</button>
    <button type="button" class="back" onclick={onBack}>Back to draft</button>
  {/if}
</div>

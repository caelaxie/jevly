# Draft mark

The draft mark is the `jev` pill on a focused text field. Choosing it opens a card with audience, directness, and ready to send.

## Sub-features

- `mark-blocking` shows `blunt` when the stub says the draft is public and not safe to send.
- `mark-card` opens the card on that same draft and shows `public`.

## How to get to it (user POV)

- Focus the `Draft` textarea on the verification compose page.
- Choose the `jev` mark.

## Driving it with verify-jevly

Preconditions:

- `doctor --run <id>` reports `ok: true`.
- The run's stub is up. `launch` already started it.

- **Show the mark.** Focus `Draft` and wait out the check. Run `node .cursor/skills/verify-jevly/verify-jevly.mjs drive draft-mark --run <id>`. The command passes only when the mark text includes `blunt`.
- **Open the card.** The same command chooses the mark. The card text includes `public` and `This draft`.
- **Proof.** The run writes `/tmp/jevly-verify-evidence/<id>/draft-mark/card.png` and `draft-mark/state.json`. `state.json` has `card.cardOn` true.

## Gotchas

- The mark reads `…` for a moment before the stub answers. Waiting only for the pill to exist accepts that loading state.
- A missing key paints `key`, not `blunt`. Save through the popup first. The drive does that.
- The card is inside `jevly-overlay`'s shadow root. A page-level `.card` selector misses it.

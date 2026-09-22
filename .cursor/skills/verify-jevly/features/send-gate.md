# Send gate

Send gate stops the compose page's Send button when the verdict is not clear, lets Send anyway through, and lets a clear draft send with no sheet.

## Sub-features

- `gate-hold` cancels Send and shows the sheet while `data-sent` stays `0`.
- `gate-anyway` chooses `Send anyway` and the page records the send.
- `gate-clear` sends a passing draft with the sheet closed.

## How to get to it (user POV)

- Focus the `Draft` textarea.
- Choose the `Send` button.
- On the sheet, choose `Send anyway`, or change the draft and choose `Send` again when the mark reads `plain`.

## Driving it with verify-jevly

Preconditions:

- `doctor --run <id>` reports `ok: true`.
- The fixture button's accessible name is `Send`.

- **Hold Send.** Run `node .cursor/skills/verify-jevly/verify-jevly.mjs drive send-gate --run <id>`. After the mark reads `blunt`, the command chooses `Send`. The sheet text includes `block this send` and `data-sent` is `0`.
- **Send anyway.** The same command chooses `Send anyway`. `data-sent` becomes `1`.
- **Clear draft.** The same command fills `Hi Maya. Can we talk Thursday?`, waits until the mark reads `plain`, and chooses `Send`. `data-sent` becomes `1` and the sheet stays closed.
- **Proof.** Screenshots are `/tmp/jevly-verify-evidence/<id>/send-gate/mark.png`, `sheet.png`, and `clear.png`. `send-gate/result.json` has `held` `0`, `anyway` `1`, `clear` `1`, `sawDraft` true, and `sawPassword` false. `stub.jsonl` contains the blocking draft text.

## Gotchas

- Choosing `Send` moves focus onto the button. The mark has to stay up across that focus change or the click is not held.
- A button named anything other than Send, Post, Reply, Comment, or Publish is not a gate. The fixture uses `Send`.
- The content script does not run inside iframes. A compose box in an iframe is a different entry point and this drive does not cover it.
- `npm test` does not click Send.

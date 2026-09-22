# Save API key

Save API key stores the popup value in the extension and shows `Saved.` again the next time the popup opens.

## Sub-features

- `key-save` writes the key from the popup and shows `Saved.`
- `key-reopen` opens the popup a second time and still shows `Saved.`

## How to get to it (user POV)

- Open the Jevly toolbar popup.
- Type the key into `API key`.
- Choose `Save`.
- Open the popup again.

## Driving it with verify-jevly

Preconditions:

- `doctor --run <id>` reports `ok: true`.
- The value typed is `verify-not-a-real-key`, not a real TypeSafe key.

- **Save.** Run `node .cursor/skills/verify-jevly/verify-jevly.mjs drive save-api-key --run <id>`. The command opens `popup.html`, fills `API key`, and chooses `Save`. `.status` becomes `Saved.`
- **Reopen.** The same command opens `popup.html` again. `.status` is `Saved.`
- **Proof.** `/tmp/jevly-verify-evidence/<id>/save-api-key/status.json` has `first` and `second` both `Saved.` `save-api-key/popup.png` is the second open.

## Gotchas

- The input is a password field. Assert `.status`, not a screenshot of the typed characters.
- An empty save returns `.status` to `No key yet.`
- This drive does not prove the mark. A saved key with no focused draft still shows no pill.

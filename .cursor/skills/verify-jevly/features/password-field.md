# Password field

A password field does not get the mark, and its value is not posted to the stub.

## Sub-features

- `password-hide` removes the mark when `Secret` is focused.
- `password-unread` leaves `fixture-secret` out of `stub.jsonl`.

## How to get to it (user POV)

- Focus the `Secret` password field on the verification compose page.

## Driving it with verify-jevly

Preconditions:

- `doctor --run <id>` reports `ok: true`.
- The fixture password value is `fixture-secret`.

- **Hide the mark.** Run `node .cursor/skills/verify-jevly/verify-jevly.mjs drive password-field --run <id>`. The command focuses `Secret`. The mark's `on` class is absent.
- **Proof.** `/tmp/jevly-verify-evidence/<id>/password-field/hidden.png` shows the page without the pill. `password-field/state.json` has `badgeOn` false and `leaked` false. `stub.jsonl` has no `fixture-secret`.

## Gotchas

- Focusing `Draft` first is required so a check has run. The drive does that, then moves to `Secret`.
- A late stub response must not paint the mark again after the password focus. Hiding the overlay drops that in-flight check.
- Do not assert on the password input's value. Assert that the stub log lacks it.

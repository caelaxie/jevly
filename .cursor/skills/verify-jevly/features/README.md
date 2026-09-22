# Jevly verification map

This directory is the maintained source for verifying what a person can do with the Jevly extension. Read the index before driving, then use the matching feature file.

## Baseline preconditions

- Launch with `node .cursor/skills/verify-jevly/verify-jevly.mjs launch` and keep the printed run id.
- `doctor --run <id>` reports `ok: true` before a drive.
- The popup key filled by a drive is `verify-not-a-real-key`. Never type a real TypeSafe key.
- The stub at the run's `jevEndpoint` is the stand-in for `https://api.typesafe.ai/v1/systemone`.
- Do not drive the user's installed Chrome, and do not drive a run you did not launch.

## Driving conventions

- Start from the baseline unless a feature file says otherwise.
- Prefer the popup label `API key`, the button `Save`, the fixture `#send` name `Send`, and the shadow host `jevly-overlay`.
- Treat every `verify-jevly.mjs` command as literal.
- Run drives through `node .cursor/skills/verify-jevly/verify-jevly.mjs drive <feature> --run <id>`.
- Leave `/tmp/jevly-verify-evidence/<id>` in place during cleanup.

## Proof and skip reporting

- Capture the action and the state it caused. A final screenshot with no earlier shot is not enough.
- UI proof includes the screenshot named in the feature file and the text of the mark, card, or sheet.
- Send proof includes `document.body.dataset.sent` before and after the click.
- Network proof includes `stub.jsonl`. The body must contain the draft and must not contain `fixture-secret`.
- Record the feature id and the run id with the artifacts.
- An entry point you did not drive is unverified. Do not report it as covered by a different drive.

## Feature entry contract

Each feature file starts with an H1 and one paragraph. Then four H2 sections, in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with verify-jevly`, `Gotchas`.

## Features

- [Draft mark](./draft-mark.md) covers the mark on a focused draft and the card behind it.
- [Send gate](./send-gate.md) covers a held Send, Send anyway, and a clear draft that sends.
- [Save API key](./save-api-key.md) covers saving the key from the toolbar popup and seeing it again.
- [Password field](./password-field.md) covers the mark staying off a password field and the value staying out of the stub.

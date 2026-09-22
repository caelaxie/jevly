---
name: verify-jevly
description: Drive the Jevly Chrome extension in a disposable Playwright Chromium. Use when proving the draft mark, the send gate, the popup API key, or that a password field stays unread.
---

# Verify Jevly

Jevly is a Manifest V3 Chrome extension. A person writes in a text field, sees a `jev` mark, and may be stopped at Send. There is no app server. Verification builds `.output/chrome-mv3`, loads that directory in Playwright's Chromium, and drives a local compose page plus the extension popup.

Do not attach to the user's installed Chrome. Branded Chrome does not accept `--load-extension`. Do not type a real TypeSafe API key into the popup. The drive fills `verify-not-a-real-key`. The stub does not check the bearer token.

Two runs can sit side by side. Each `launch` picks its own profile, fixture port, stub port, and debugging port. Pass that run id to every later command. Driving `latest` while another run is alive can hit the wrong browser.

## Launch

From the repo root:

```
node .cursor/skills/verify-jevly/verify-jevly.mjs launch
```

Ready looks like this line:

```
READY run=<id> fixture=http://127.0.0.1:<port>/ evidence=/tmp/jevly-verify-evidence/<id>
```

`launch` runs `npm run build`, then starts one session process. That process serves the compose page, serves the Jev stub, and holds a Playwright persistent context on a fresh profile with the unpacked extension loaded. The compose page and the Playwright install under `/tmp/jevly-verify-playwright` are verification scaffolding, not product files. A raw `--remote-debugging-port` on this Chromium build does not accept a later connection, so drive commands talk to the session, not to DevTools.

## Doctor

Run this before a drive, and again whenever the mark is missing or the browser looks dead.

```
node .cursor/skills/verify-jevly/verify-jevly.mjs doctor --run <id>
```

The command prints JSON. `ok` must be true. It checks that the session pid is alive and that `GET /health` on that session reports `manifestName` true and `serviceWorker` true. The manifest check is `.output/chrome-mv3/manifest.json` with `"name": "Jevly"`. Exit code 1 means the instance is not worth driving.

## Drive

The harness is `verify-jevly.mjs`. It opens `chrome-extension://<id>/popup.html` and the fixture page. The mark lives in the open shadow host `jevly-overlay`. Inside that root the handles are `.badge`, `.card`, and `.sheet` (`role="dialog"`, name `Send check`). The sheet buttons are `.anyway` (`Send anyway`) and `.back` (`Back to draft`). The fixture controls are `#draft`, `#send` (accessible name `Send`), and `#secret`.

The popup controls are the textbox labeled `API key`, the button `Save`, and `.status`.

`drive` sets `jevEndpoint` in extension storage to the run's stub. That storage key is the production stand-in for `https://api.typesafe.ai/v1/systemone`. It then saves the key through the popup. Do not call `write-key` yourself and do not paste a real key.

```
node .cursor/skills/verify-jevly/verify-jevly.mjs drive send-gate --run <id>
node .cursor/skills/verify-jevly/verify-jevly.mjs drive draft-mark --run <id>
node .cursor/skills/verify-jevly/verify-jevly.mjs drive save-api-key --run <id>
node .cursor/skills/verify-jevly/verify-jevly.mjs drive password-field --run <id>
```

A passing drive prints `PASS <feature>`. Read the feature file before claiming a path you did not drive.

## Evidence

Proof files stay in `/tmp/jevly-verify-evidence/<id>/`. Cleanup does not delete that directory.

- `send-gate/mark.png` is the mark before Send.
- `send-gate/sheet.png` is the sheet while `document.body.dataset.sent` is still `0`.
- `send-gate/clear.png` is the page after a clear draft sends.
- `send-gate/result.json` records `held`, `anyway`, `clear`, whether the stub saw the draft, and whether it saw `fixture-secret`.
- `draft-mark/card.png` and `draft-mark/state.json` show the open card.
- `save-api-key/popup.png` and `save-api-key/status.json` show `Saved.` on a second open of the popup.
- `password-field/hidden.png` and `password-field/state.json` show the mark gone and `leaked: false`.
- `stub.jsonl` is every POST the stub accepted. A proof that only screenshots the mark is incomplete. The stub line must contain the draft text and must not contain `fixture-secret`.

The extension's `npm test` checks `parseAnswers`. It does not prove the mark or Send.

## Cleanup

```
node .cursor/skills/verify-jevly/verify-jevly.mjs cleanup --run <id>
```

This asks the session to close its browser, then `SIGKILL`s the session pid if it is still alive, and deletes `/tmp/jevly-verify-runs/<id>`. It does not delete `/tmp/jevly-verify-evidence/<id>`. Do not kill Chromium by name. After a failed drive, run cleanup before launching again.

## Helpers

`node .cursor/skills/verify-jevly/verify-jevly.mjs` is the only helper. Run it from the repo root with one of `launch`, `doctor`, `drive`, or `cleanup`.

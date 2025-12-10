# Slack URL Verification — Testing

Purpose: Quick reference for testing Slack's `url_verification` challenge against the local or ngrok-exposed endpoint used by this repo.

Endpoint: `POST /api/integrations/slack/events` (prepend your host or ngrok tunnel).

Prerequisites

* Env var: Ensure the running backend and your test use the same `SLACK_SIGNING_SECRET` value.
* Tools: `openssl` and `xxd` must be available to compute the HMAC used by Slack signatures.

Signed curl (step-by-step)

Update the `SLACK_SIGNING_SECRET` and `URL` values below and run in `bash`:

```bash
export SLACK_SIGNING_SECRET="your_slack_signing_secret_here"
export URL="https://caperingly-equiangular-maurine.ngrok-free.dev/api/integrations/slack/events"
export BODY='{"type":"url_verification","challenge":"TEST_CHALLENGE"}'
export TS=$(date +%s)

# compute signature (requires openssl + xxd)
export SIG="v0=$(printf 'v0:%s:%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SLACK_SIGNING_SECRET" -binary | xxd -p -c 256)"

curl -i -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "X-Slack-Request-Timestamp: $TS" \
  -H "X-Slack-Signature: $SIG" \
  -d "$BODY"
```

Signed curl (single-line)

```bash
SLACK_SIGNING_SECRET="your_slack_signing_secret_here" URL="https://caperingly-equiangular-maurine.ngrok-free.dev/api/integrations/slack/events" BODY='{"type":"url_verification","challenge":"TEST_CHALLENGE"}' TS=$(date +%s) SIG="v0=$(printf 'v0:%s:%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SLACK_SIGNING_SECRET" -binary | xxd -p -c 256)" && curl -i -X POST "$URL" -H "Content-Type: application/json" -H "X-Slack-Request-Timestamp: $TS" -H "X-Slack-Signature: $SIG" -d "$BODY"
```

Expected result

* HTTP status: `200` (OK)
* Body: the same challenge echoed back, e.g. `{"challenge":"TEST_CHALLENGE"}`

Troubleshooting

* If the response body is `{"error":"Invalid signature"}`:
  * Confirm the `SLACK_SIGNING_SECRET` used to compute the signature exactly matches the backend's value.
  * Verify your system clock; Slack rejects requests with timestamps skewed > ~5 minutes.
  * Ensure the `BODY` string you sign is byte-exact to the JSON payload you send (no extra whitespace or encoding changes).
  * Confirm `openssl` and `xxd` are available on your machine; the provided commands rely on them.

Local host example

* If your API runs on `localhost:3000`, set `URL="http://localhost:3000/api/integrations/slack/events"` and run the same signed curl steps above.

Dev-only bypass

* If you prefer a temporary local bypass, I can add a dev-only toggle (for example `DISABLE_SLACK_SIGNATURE_VERIFY=true`) that will skip signature validation while present. This is strongly discouraged in non-dev environments — ask me if you want me to add that helper.

Repo locations

* Runtime events: `backend/src/integrations/slack/slack-integration.controller.ts`
* Signature helper: `backend/src/integrations/slack/slack-integration.service.ts`

References

* Slack docs — Verifying requests from Slack: https://api.slack.com/authentication/verifying-requests-from-slack

# Call Guardian AI — MVP 0.1

**Pilot scaffold; NOT production-ready.** Delivers real Telnyx inbound answering, rule-based contact lookup, DTMF-based urgency, multi-tenant-ready relational schema, webhook signature verification, deduplication and call history.

## Prerequisites
Node.js 20+, Docker, a Telnyx Voice API number/connection, ngrok (or public HTTPS).

## Run
```bash
cp .env.example .env
# Update credentials, real Telnyx number, DB secrets and public key.
docker compose up -d
npm install
npm run start:dev
```

Set your number in `phone_numbers`:
```sql
UPDATE phone_numbers SET telnyx_e164='+1YOUR_TELNYX_NUMBER' WHERE user_id=1;
```

Example trusted contact:
```sql
INSERT INTO contacts (user_id,display_name,phone_e164,classification,priority)
VALUES (1,'Sample Coach','+13055550102','TRUSTED',TRUE);
```

Expose backend with `ngrok http 3100`. Configure Telnyx Voice API application webhook V2 as `https://your-ngrok-domain/webhooks/telnyx` and configure its webhook signing public key in `.env`. Confirm the real incoming call `to` matches the Telnyx E.164 number saved to the database. **Do not configure mobile call forwarding until direct calls to the Telnyx number work.**

## Expected behavior
1. `call.initiated`: lookup tenant from Telnyx destination and contact by `from`; answer.
2. `call.answered`: prompt known / unknown callers to press 1 (important) or 2 (normal). Blocklisted callers hear a brief refusal.
3. `call.gather.ended`: persist DTMF/decision; play confirmation.
4. `call.speak.ended`: hang up on final confirmation.
5. `call.hangup`: record completion.

## Known limitations / next development tasks
- **This is NOT the final AI screening flow.** The DTMF menu is the initial verified telephony integration. Speech recognition, transcription, OpenAI classification and reviewable messages come next. `OPENAI_API_KEY` is unused in v0.1.
- No recordings or consent flow yet, no Angular UI, no login/auth API, no contact upload, no outbound transfers or notifications. Do not advertise those as implemented.
- `webhook_events` currently marks events processed *before* Telnyx call commands succeed; retries of failed commands require a proper transactional outbox/worker. High-volume production should enqueue after checking signatures and respond 200 immediately.
- In-memory Telnyx call-control response handling assumes events arrive sequentially; for production use queue+call state machine. `speak` response completion must be tested on live calls and tuned for observed event behavior.
- No automatic false-positive protection yet: blocked numbers are manually configured, and the inbound calling number may be spoofed. For conservative initial testing leave contacts `NORMAL`, not `BLOCKED`.
- The example uses `speak` TTS, which may incur voice-provider-specific charges. Replace stable prompts with prerecorded audio after validating.
- This code intentionally avoids call recording to avoid recording consent surprises. Add compliant consent workflow before storing audio/transcriptions.

## Deployment/security
Change local database passwords, protect DB port, implement production event queues, logging redaction, auth/RBAC, rate limits, retention policy and billing limits. Never enable `ALLOW_UNSIGNED_WEBHOOKS` on an exposed instance. The signature validator uses raw JSON bytes and Telnyx Ed25519 public key; verify its behavior against actual signed sample payloads.

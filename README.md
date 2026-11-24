# Truth Be Told — Hosted by Jesus

HSW365 Media conversational web application.

## Local run
1. Install Node.js 20+.
2. Run `npm install`.
3. Set `OPENAI_API_KEY` to enable AI answers.
4. Run `npm start` and open http://localhost:3000.

## Environment
- `OPENAI_API_KEY` — required for AI responses.
- `OPENAI_MODEL` — optional; defaults to gpt-4o-mini.
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` — required to enable subscriptions and webhook processing.
- `APP_URL` — canonical deployed URL.

## Important production work still required
- Configure verified email authentication (the included session endpoint is a scaffold, not production identity verification).
- Add persistent PostgreSQL storage for users, sessions, conversation history, and subscription entitlements; current in-memory maps reset on restart and are not multi-instance safe.
- Configure Stripe product/price at USD $8/month and webhook endpoint `/api/stripe/webhook`; live billing is intentionally not activated by this scaffold.
- Configure OpenAI key in Render; never commit secrets.
- Live call screen: hold-to-talk mic (browser speech recognition), spoken answers via free neural TTS (`/api/speak`, `TTS_VOICE`/`TTS_RATE`/`TTS_PITCH` env), face generated with iRun's image engine and animated in-browser from the audio. SadTalker-quality lip-sync is not real-time on free CPU; it would need a GPU worker.
- Add rate limiting, CSRF protections, verified login, privacy controls, retention/deletion, monitoring, and end-to-end tests before public launch.

## Host integrity
The avatar is an AI character inspired by Jesus and is not represented as the historical Jesus or a divine being. Responses distinguish biblical text, historical evidence, religious belief, and uncertainty.

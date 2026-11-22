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
- Add the approved portrait file at `public/avatar.jpg`.
- Configure verified email authentication (the included session endpoint is a scaffold, not production identity verification).
- Add persistent PostgreSQL storage for users, sessions, conversation history, and subscription entitlements; current in-memory maps reset on restart and are not multi-instance safe.
- Configure Stripe product/price at USD $8/month and webhook endpoint `/api/stripe/webhook`; live billing is intentionally not activated by this scaffold.
- Configure OpenAI key in Render; never commit secrets.
- Integrate iRUN voice synthesis and SadTalker talking-face rendering as a separate worker/service with secure job queue and model storage. This UI currently offers browser speech output and speech recognition as a fallback, not iRUN's generated voice or full real-time calling.
- Add rate limiting, CSRF protections, verified login, privacy controls, retention/deletion, monitoring, and end-to-end tests before public launch.

## Host integrity
The avatar is an AI character inspired by Jesus and is not represented as the historical Jesus or a divine being. Responses distinguish biblical text, historical evidence, religious belief, and uncertainty.

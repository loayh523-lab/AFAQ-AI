# AFAQ AI — آفاق

**Intelligence Beyond Limits**

AFAQ AI is an Arabic-first AI workspace with a server-managed chat API. End users do not enter provider API keys or download model weights.

## Current preview

- Premium Arabic RTL chat interface.
- Server-side `POST /api/chat` endpoint compatible with OpenAI-style chat completion providers.
- Provider credentials remain in server environment variables and are never sent to the browser or Android client.
- Request validation, payload limits, bounded history, timeouts, and generic provider error messages.
- Android preview uses the same server-managed chat concept.

## Server configuration

Set these environment variables in the hosting platform (not in the app):

- `AFAQ_PROVIDER_API_KEY`: provider secret.
- `AFAQ_PROVIDER_URL`: OpenAI-compatible chat completions URL.
- `AFAQ_MODEL`: model identifier supported by that provider.

The default URL/model are examples only. The service will return a friendly unavailable response until a real provider secret is configured server-side. Never commit secrets to Git or embed them in an APK.

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
``

## Deploy

Deploy the Next.js project to a Node.js-compatible host such as Vercel, then add the three server environment variables in the project's settings. Redeploy after adding or changing secrets.

## Privacy

Chat messages are sent to the configured model provider for generation. Do not send passwords, payment details, or other sensitive information. Add authentication, rate limiting, abuse controls, and a privacy notice before opening the service publicly.

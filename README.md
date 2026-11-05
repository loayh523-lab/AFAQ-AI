# AFAQ AI — آفاق

**Intelligence Beyond Limits**

AFAQ AI is an Arabic-first AI workspace. End users do not enter provider API keys or download model weights.

## Current preview

- Arabic RTL chat interface.
- Server-side `POST /api/chat` endpoint.
- Server-side authentication to Vercel AI Gateway using the deployment's Vercel OIDC identity; no provider secret is embedded in the APK or browser.
- Default model: `zai/glm-4.6v-flash` (listed with zero token price in the Gateway catalog at the time of implementation). Availability and any gateway/account requirements can change.
- Request validation, payload limits, bounded history, timeouts, and generic provider error messages.

## Server configuration

Vercel deployments provide `VERCEL_OIDC_TOKEN` automatically. Optionally set `AFAQ_MODEL` in the hosting environment to a currently supported AI Gateway model ID. Do not add provider keys to the app or commit secrets.

## Run locally

Requires Node.js 20.9 or newer. Local development needs a valid Vercel OIDC token from a linked Vercel project, or an approved server-side Gateway credential. The Android/browser user never enters it.

```bash
npm install
npm run dev
```

## Deploy

Deploy this Next.js project to Vercel. The Vercel deployment identity is used for AI Gateway requests. Check the current Gateway model catalog and account eligibility before enabling public traffic.

## Privacy and safeguards

Chat messages are sent to the selected model provider through AI Gateway. Do not send passwords, payment details, or other sensitive information. Add authentication, rate limiting, abuse controls, and a clear privacy notice before opening the service publicly.

# AFAQ AI — آفاق

**Intelligence Beyond Limits**

AFAQ AI is an Arabic-first AI workspace for chat, learning, coding and practical project planning.

## Implemented in this preview

- Responsive Arabic RTL interface using midnight blue, black and green.
- Persistent conversation history in the user's browser and Android app storage.
- Search, rename, delete, and export conversation history (web).
- Real preferences: color themes, response style, font size and Enter-to-send behavior.
- Focused starter tools for coding, study, writing, ideation and project planning.
- Server-side chat endpoint at `POST /api/chat`; no provider key or model download is required from end users.
- Android app connects to the same managed endpoint and stores chat history locally.
- The model is configured on the server; the current default is the free-priced `nvidia/nemotron-3.5-lightning-free` model listed by Vercel AI Gateway. Provider availability and account eligibility may change.

## Server operation

Vercel deployments use the deployment's OIDC identity to authenticate server-side requests to AI Gateway. The client does not receive the token. The optional `AFAQ_MODEL` variable can select another currently supported model ID.

Vercel's AI Gateway documentation says its free monthly credit tier requires a valid payment method for team verification; this project does not configure or add any payment method. The selected model is listed with zero input/output token price, but live service availability still needs to be confirmed on the deployment.

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Local server-side model requests require an authorized Vercel OIDC context. End users never enter credentials into the app.

## Build Android

```bash
gradle --no-daemon :android:app:assembleDebug
```

## Privacy and limitations

Conversation history is stored locally in the browser or on the Android device. Messages sent for generation are forwarded by the AFAQ server to the configured model provider. Do not send passwords or other confidential information.

Before opening the service broadly, add authentication, server-side rate limiting/abuse protection, a published privacy policy, account controls and monitoring. Image generation, file uploads, code execution sandboxes and cross-device cloud conversation sync are not implemented in this preview.

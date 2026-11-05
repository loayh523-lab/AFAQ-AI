# AFAQ AI — آفاق

**Intelligence Beyond Limits**

AFAQ AI is an Arabic-first multi-model AI workspace for conversations, programming help, and creative work.

## Current MVP
- Premium responsive Arabic RTL chat interface.
- Provider switcher for Google Gemini and OpenAI-compatible APIs.
- Server-side API routes; API keys are never exposed to the browser.
- Mobile-friendly layout and in-session conversation state.

## Run locally
Requires Node.js 20.9+.

```bash
npm install
cp .env.example .env.local
# Add GEMINI_API_KEY to .env.local
npm run dev
```
Open http://localhost:3000.

## Environment variables
- `GEMINI_API_KEY`: Google Gemini API key.
- `GEMINI_MODEL`: optional model name; defaults to `gemini-2.5-flash`.
- `AI_API_KEY`: optional key for an OpenAI-compatible API.
- `AI_BASE_URL`: optional API base URL; defaults to OpenAI v1.
- `AI_MODEL`: optional model name; defaults to `gpt-4o-mini`.

Never commit real keys or `.env.local`. Add secrets in your hosting provider's environment settings.

## Deploy
Import the repository into Vercel, add the environment variables, and deploy. Git-connected deployments can rebuild after pushes to the production branch.

## Roadmap
1. Streaming output and saved conversations.
2. Additional provider adapters and intelligent model routing.
3. Secure coding workspace with isolated project execution.
4. Image generation integration.
5. Android app shell and account sync.

**Status:** Early MVP. Autonomous coding, image generation, file workspace, and Android packaging are not implemented yet.

# AFAQ AI

**THINK BEYOND. BUILD BEYOND.**

AFAQ AI is an Arabic-first AI workspace built to help people think, learn, research, write, code and turn ideas into practical projects.

## Brand system

- Product name: **AFAQ AI**
- Brand line: **THINK BEYOND. BUILD BEYOND.**
- Visual identity: midnight black, electric blue and intelligent green.
- Primary mark: the A monogram with a horizon/orbit motif, representing ideas moving into action.
- Interface language: Arabic-first, RTL, with English product branding.

## Current preview capabilities

- Responsive Arabic RTL chat workspace.
- Local conversation history with search, rename, delete, import and export.
- Message editing and answer regeneration.
- Preferences for theme, answer style, font size and Enter-to-send.
- Starter workflows for coding, learning, writing, ideation and project planning.
- Server-side chat endpoint at `POST /api/chat`; provider credentials stay on the server.
- Android app shell uses the same managed endpoint and local conversation history.

## AI product requirements audit

### Core experience
- [x] Clear product name, slogan and visual identity.
- [x] Arabic-first responsive chat interface.
- [x] Conversation history and local persistence.
- [x] Search, rename, delete, import and export history.
- [x] Edit prompt, regenerate response, copy answer.
- [x] Theme, response style and text-size preferences.
- [ ] User accounts and secure sign-in.
- [ ] Cross-device cloud sync and conversation backup.
- [ ] Pin, archive, branch and organize conversations into projects.

### Intelligence and tools
- [x] Central server-managed model connection.
- [x] Model/provider configuration kept server-side.
- [ ] Live web search with source citations.
- [ ] File and image uploads with document understanding.
- [ ] Image generation and image editing.
- [ ] Voice input and spoken responses.
- [ ] Data analysis for CSV/XLSX and visual charts.
- [ ] Reliable tool calling and multi-step agent workflows.
- [ ] Sandboxed code execution and project workspace.
- [ ] Model selection, capability labels and usage visibility.

### Trust, privacy and operations
- [x] Input validation, payload limits and upstream timeout.
- [x] Privacy notice explaining provider processing.
- [ ] Authentication and per-user authorization.
- [ ] Server-side rate limits, abuse controls and quotas.
- [ ] Published privacy policy, retention and deletion controls.
- [ ] Error monitoring, service health and user feedback.
- [ ] Accessibility checks, localization QA and automated tests.

## Important current limitations

This repository is a preview, not a finished all-in-one AI service. Image generation, uploads, voice, web search, cloud accounts/sync and sandboxed coding are not implemented yet. The Android client currently targets a Vercel preview deployment; it must be changed to an accessible production endpoint before public use. Do not describe a feature as available until its backend, UI, security and tests are complete.

## Server operation

Vercel deployments use the deployment OIDC identity to authenticate server-side requests to AI Gateway. The client never receives that token. The optional `AFAQ_MODEL` variable selects the server-side model. Live availability and provider eligibility must be verified on the deployed environment.

## Local development

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Local model requests require an authorized Vercel OIDC context.

## Android build

```bash
gradle --no-daemon :android:app:assembleDebug
```

## Privacy

Conversation history is stored locally in the browser or Android app. Messages sent for generation are forwarded by the AFAQ server to the configured model provider. Do not send passwords or confidential information.

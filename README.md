# AFAQ AI

**THINK BEYOND. BUILD BEYOND.**

AFAQ AI is an Arabic-first AI workspace for learning, research, writing, coding and practical problem-solving.

## Brand

- Product: **AFAQ AI**
- Tagline: **THINK BEYOND. BUILD BEYOND.**
- Identity: midnight black, electric blue and intelligent green.
- Interface: Arabic-first, RTL, with English product branding.

## Implemented in the current branch

### Conversation experience
- [x] Responsive Arabic RTL web chat and native Android client.
- [x] Local conversation history, search, rename, delete, import and export.
- [x] Edit prompts, regenerate answers, copy messages and preserve conversation context.
- [x] Streaming assistant replies with typing feedback and recoverable error states.
- [x] Markdown answers with headings, lists, GFM tables, code blocks, links and LaTeX equations.
- [x] Theme, answer style, font size and Enter-to-send preferences.
- [x] Mobile composer with multiline input, attachment picker and web/image actions.
- [x] Local Android notifications when a response finishes while the app process remains alive in the background.

### Model and tools integration
- [x] Server-managed model access through Vercel AI Gateway; provider credentials are not shipped in the client.
- [x] Responses API streaming.
- [x] Web search tool integration with source citations.
- [x] Image understanding and PDF, Word, PowerPoint, Excel, CSV and text file inputs.
- [x] Image-generation tool integration.
- [x] Python code-interpreter tool integration for calculation and data analysis.
- [x] Signed, short-lived download links for generated container files in the code path.
- [ ] Download links require a private `OPENAI_API_KEY` or `AFAQ_OPENAI_API_KEY` in Vercel. This project currently has no such variable configured, so downloadable generated files are not yet enabled in the deployed environment.
- [ ] Image editing of user-provided images is not exposed as a separate workflow yet.

### Android
- [x] Native Compose chat UI, local history and settings.
- [x] Document picker and image/file upload request support.
- [x] Streaming text responses, source links, generated-image display and generated-file link display.
- [x] Notification permission and local notification channel.
- [ ] Firebase Cloud Messaging for notifications after the application process is terminated.
- [ ] Public production API origin and end-to-end device test.

## Deployment prerequisites and current limitations

This branch builds successfully in GitHub Actions and the Vercel preview deployment reached `READY`. However, the preview deployment is protected by Vercel SSO. The Android app cannot authenticate to that SSO-protected preview URL, so a real model response has **not** yet been verified from the installed Android app.

Do not disable deployment protection or expose the AI endpoint publicly until secure sign-in, per-user quotas, request rate limits and abuse controls are in place. Model calls, image generation and code-interpreter usage can incur provider charges.

### Required before public launch

- [ ] Authentication and per-user authorization.
- [ ] Server-side rate limits, usage quotas and abuse prevention.
- [ ] A public production API origin with authentication; do not point clients at a protected preview alias.
- [ ] End-to-end smoke tests from web and Android against the actual provider.
- [ ] Private OpenAI API key in Vercel to enable generated-file downloads.
- [ ] Firebase Cloud Messaging for true push notifications after force-stop/termination.
- [ ] Privacy policy, retention/deletion controls, monitoring and feedback reporting.
- [ ] Cross-device accounts, cloud sync, projects, pins and archive.

## Server configuration

Vercel deployments use the deployment OIDC identity to authenticate server-side requests to AI Gateway. The client never receives that token. Optional `AFAQ_MODEL` and `AFAQ_IMAGE_MODEL` variables select server-side models.

To enable generated-file downloads, add `OPENAI_API_KEY` (or `AFAQ_OPENAI_API_KEY`) as a **private encrypted environment variable** in the Vercel project. Never place this key in the Android app, browser code, repository or chat messages. Treat provider keys and model usage as sensitive account credentials.

## Local development

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Local AI generation requires an authorized Vercel OIDC context or a private server-side AI Gateway credential. The Android client reads its API origin from `AFAQ_API_BASE_URL` in Gradle configuration.

## Android build

```bash
gradle --no-daemon :android:app:assembleDebug
```

## Privacy

Conversation history is stored locally in the browser or Android app. Messages and attachments submitted for generation are sent by the AFAQ server to the configured model provider. Do not send passwords, payment details or confidential information.

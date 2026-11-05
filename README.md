# AFAQ AI — آفاق

**Intelligence Beyond Limits**

AFAQ AI is an Arabic-first AI workspace. The first test build runs a small open model directly in the browser with WebGPU.

## Current MVP

- Premium responsive Arabic RTL chat interface.
- Local inference using WebLLM and Qwen 2.5 0.5B Instruct (4-bit).
- No provider API key is required for the local test model.
- Chat prompts are processed on the device after the model files are downloaded.
- Model loading progress and a clear WebGPU compatibility message.

## Requirements

- A modern browser with WebGPU support.
- Approximately 945 MB of available GPU memory for this model configuration.
- A stable connection for the first model download. The browser caches model files for later use where supported.
- Devices without compatible WebGPU hardware cannot run this local model in the browser.

The 0.5B model is intentionally small for an initial test. It is not comparable to large hosted models and may make mistakes, especially on complex coding tasks or long Arabic conversations.

## Build verification

The repository CI installs dependencies and runs `npm run build` on pull requests and pushes to `main`.

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000, choose **تحميل نموذج الاختبار**, wait for the model to initialize, and then send a message.

## Deployment

Import this repository into Vercel, use the default Next.js settings, and deploy. No environment variables are required for the local model. The deployed site still relies on the visitor's browser and device to run inference.

## Roadmap

1. Improve local model choices and device capability detection.
2. Add conversation export and optional local persistence.
3. Add a secure project workspace for coding tasks.
4. Add image generation through an age-appropriate, policy-compliant provider.
5. Build the Android app shell.

## Model and runtime

- Runtime: [WebLLM](https://github.com/mlc-ai/web-llm)
- Model: `Qwen2.5-0.5B-Instruct-q4f16_1-MLC`
- Inference is performed in the browser using WebGPU.

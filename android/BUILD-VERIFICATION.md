# AFAQ AI Android test build

The Android module is a native Kotlin/Jetpack Compose application.

- Model: Qwen3 0.6B LiteRT-LM
- Inference: on-device CPU
- Model file is downloaded to app-private storage after installation; it is not bundled in the APK.
- The first download requires internet and roughly 600 MB of storage. The model remains available locally for later offline sessions.
- Minimum Android version: Android 8.0 (API 26).

Build command:

```bash
gradle :android:app:assembleDebug
```

The GitHub Actions workflow builds a debug APK and uploads it as an artifact for testing.

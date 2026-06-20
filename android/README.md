# LapKart Android

Capacitor Android shell for the existing SvelteKit storefront.

## Build Flow

Run from the repository root:

```powershell
npm.cmd run android:build
```

This performs:

1. writes the required `www/index.html` placeholder
2. `cap sync android`
3. `gradlew.bat assembleDebug`

The debug APK is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Runtime Notes

- The Android app loads `https://www.lapkart.store/` by default so SvelteKit SSR, auth, checkout, and server endpoints keep their existing behavior.
- Android back navigation is handled in `src/lib/native/capacitor.ts`: WebView history first, `/` fallback for direct deep links, then app minimize.
- `CAP_SERVER_URL=http://... npm.cmd run android:sync` can be used for live development.
- `npm.cmd run android:web` creates a static SvelteKit output in `www/` for inspection, but the current storefront still depends on SvelteKit server/data routes, so production APKs should use the default remote storefront runtime.

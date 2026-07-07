# LapKart Android

Capacitor Android shell for the existing SvelteKit storefront.

## Debug Build

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

## Play Store Release

New Play Store uploads should use an Android App Bundle, not a release APK:

```powershell
npm.cmd run android:release
```

This performs:

1. writes the required `www/index.html` placeholder
2. `cap sync android`
3. `gradlew.bat bundleRelease`

The Play upload file is written to:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

### Release Signing

Release signing is read from `android/key.properties`, which is intentionally ignored by Git.

1. Create an upload key:

```powershell
New-Item -ItemType Directory -Force android/release
keytool -genkeypair -v -keystore android/release/lapkart-upload.jks -storetype PKCS12 -keyalg RSA -keysize 4096 -validity 10000 -alias lapkart-upload
```

2. Copy the example file and fill the passwords:

```powershell
Copy-Item android/key.properties.example android/key.properties
```

3. Run the release command again:

```powershell
npm.cmd run android:release
```

Keep `android/release/lapkart-upload.jks` and `android/key.properties` backed up privately. Losing the upload key can block future app updates until Google resets it.

## Play Console Checklist

- Package name: `com.lapkart.store`
- App name: `LapKart`
- Target SDK: `36`
- Privacy policy URL: `https://www.lapkart.store/privacy`
- Terms URL: `https://www.lapkart.store/terms`
- App content: ecommerce / shopping for laptop parts
- Ads: declare "No" unless ads are added later
- Restricted access: public catalog; checkout requires account/payment
- Data safety: declare account/contact info, delivery address, order/payment references, support messages, device/app diagnostics, local cache/cart storage, and optional location/camera access as described in the Privacy policy
- Location permission: used only when the customer chooses delivery-location assistance
- Camera permission: used only when a user/admin chooses an image workflow
- Notifications: disabled by default. Only enable Play notification declarations after reinstalling `@capacitor/push-notifications`, setting `PUBLIC_NATIVE_PUSH_ENABLED=true`, adding `google-services.json`, and testing push delivery.
- App links: after enabling Play App Signing, publish the Play app-signing SHA-256 fingerprint in `https://www.lapkart.store/.well-known/assetlinks.json`

## Runtime Notes

- The Android app loads `https://www.lapkart.store/` by default so SvelteKit SSR, auth, checkout, and server endpoints keep their existing behavior.
- Android back navigation is handled in `src/lib/native/capacitor.ts`: WebView history first, `/` fallback for direct deep links, then app minimize.
- `CAP_SERVER_URL=http://... npm.cmd run android:sync` can be used for live development.
- `npm.cmd run android:web` creates a static SvelteKit output in `www/` for inspection, but the current storefront still depends on SvelteKit server/data routes, so production APKs should use the default remote storefront runtime.

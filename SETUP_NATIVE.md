# Setting up the real React Native project

The `mobile/` folder contains all of WorldLens's JavaScript/TypeScript UI,
our custom Kotlin native modules (Camera, ML, Tracking, Voice),
`build.gradle` files (with CameraX + ONNX Runtime Mobile deps), assets,
labels, and configuration.

What's missing are the **generated native scaffolding files** from React
Native itself (Gradle wrapper, `settings.gradle`, `gradle.properties`,
resource mipmaps, iOS Xcode project, etc.) — those are large,
machine-specific, and easy to regenerate on your machine.

---

## 1. Prerequisites (Windows)

Install these once:

- **Node.js 18+** (already have)
- **JDK 17** — e.g. `winget install Microsoft.OpenJDK.17`
- **Android Studio** with:
  - Android SDK (platform 34)
  - Android SDK Build-Tools 34
  - An Android emulator (or a real device with USB debugging on)
- **Environment variables** in System Properties → Advanced → Environment Variables:
  - `ANDROID_HOME` = `C:\Users\<you>\AppData\Local\Android\Sdk`
  - Add to `Path`: `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\emulator`

## 2. Generate native scaffolding (from `mobile/`)

Because our repo already has `android/app/build.gradle` and
`android/build.gradle` (pre-configured with CameraX + ONNX Runtime), we
generate a fresh RN 0.73 project in a temp folder and copy only the
missing scaffolding files (not the build scripts) on top.

Run this from PowerShell in the **`mobile/`** folder:

```powershell
# Save node_modules if you already ran npm install
if (Test-Path node_modules) { Rename-Item node_modules _nm_bak -Force }

# Scaffold a fresh RN 0.73 project into a temp folder
npx @react-native-community/cli@12 init _scaffold --version 0.73.4 --skip-install --skip-git-init

# --- Merge android scaffolding (KEEP our build.gradle files) ---
# Copy the gradle wrapper and properties from the scaffold
New-Item -ItemType Directory -Force -Path .\android\gradle\wrapper | Out-Null
Copy-Item _scaffold\android\gradle\wrapper\*  .\android\gradle\wrapper\ -Force
Copy-Item _scaffold\android\gradlew          .\android\ -Force
Copy-Item _scaffold\android\gradlew.bat      .\android\ -Force
Copy-Item _scaffold\android\settings.gradle  .\android\ -Force
Copy-Item _scaffold\android\gradle.properties .\android\ -Force
# (Do NOT copy android/build.gradle or android/app/build.gradle — ours are preconfigured.)

# Copy any missing Android app resources the scaffold created (mipmaps, themes, etc.)
# Our existing AndroidManifest + MainApplication/MainActivity + Kotlin modules take precedence.
Copy-Item _scaffold\android\app\proguard-rules.pro .\android\app\ -Force -ErrorAction SilentlyContinue
# Merge res/ values (our strings.xml should win)
if (-not (Test-Path .\android\app\src\main\res\values)) { New-Item -ItemType Directory -Force -Path .\android\app\src\main\res\values | Out-Null }
# Copy mipmap launcher icons from scaffold
Copy-Item _scaffold\android\app\src\main\res\mipmap-* .\android\app\src\main\res\ -Recurse -Force
# Copy drawable / values styles the scaffold needs
Copy-Item _scaffold\android\app\src\main\res\values\styles.xml .\android\app\src\main\res\values\ -Force -ErrorAction SilentlyContinue
Copy-Item _scaffold\android\app\src\main\res\drawable -Recurse -Force -ErrorAction SilentlyContinue

# --- iOS scaffolding (optional, only if you want iOS) ---
Copy-Item _scaffold\ios .\ -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item _scaffold\Gemfile* .\ -Force -ErrorAction SilentlyContinue
Copy-Item _scaffold\.watchmanconfig .\ -Force -ErrorAction SilentlyContinue
Copy-Item _scaffold\.ruby-version .\ -Force -ErrorAction SilentlyContinue

# Cleanup
Remove-Item -Recurse -Force _scaffold
if (Test-Path _nm_bak) { Rename-Item _nm_bak node_modules -Force }
```

## 3. Install JS dependencies

```powershell
cd mobile
npm install
```

This installs `react-native-svg` and `react-native-reanimated` (already
listed in `package.json`) along with RN 0.73.

## 4. Android: reanimated plugin is already in babel.config.js ✓

`babel.config.js` already has `react-native-reanimated/plugin` registered.

## 5. Run!

```powershell
# Start Metro in one terminal
npx react-native start --reset-cache

# In a second terminal (emulator running or device plugged in):
npx react-native run-android
```

The first build takes 2-5 minutes. After that, you get hot reload on JS changes.

---

## What you get out of the box

- **Splash → Dashboard → Scanner** flow with the new premium game-style boot
  and industrial/cybernetic aesthetic (gunmetal + cyan + brass aperture logo)
- SVG aperture-shutter logo (no emoji placeholders)
- Live radar, zoom, modes, object chips, detection list, bottom dock,
  shutter, mic waveform, premium detail sheet with circular confidence gauge
- Kotlin native modules already in place at
  `android/app/src/main/java/com/worldlens/`:
  - `camera/CameraModule.kt` — CameraX frame producer
  - `ml/InferenceModule.kt` + `ml/ModelRunner.kt` — ONNX inference bridge
  - `tracking/TrackingModule.kt` — native IoU tracker
  - `voice/VoiceModule.kt` — Android SpeechRecognizer + TTS
  - `native/NativeModulePackage.kt` — React Native autolinking package
- ONNX Runtime Mobile + CameraX dependencies already in `app/build.gradle`
- Assets folder `assets/models/object_detector/labels.txt` with all 80 COCO labels

## The one remaining piece for real detections

The model file itself (`model.quant.onnx`) isn't in the repo (it's ~3-5 MB
for SSDLite-MBV3 INT8). Once you run `python ai/scripts/convert_model.py`
to download and quantize the pretrained COCO model, place the resulting
`model.quant.onnx` into:

```
mobile/assets/models/object_detector/model.quant.onnx
```

The `app/build.gradle` already bundles that folder into the APK via
`assets.srcDirs("../../assets")`. Until then, the mock frame loop drives
the UI so you can iterate on design/animations without a physical model.

## Troubleshooting

- `SDK location not found`: create `mobile/android/local.properties` with
  `sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk`
- Reanimated build errors: make sure JDK 17 is the one on PATH (not 11/20)
- Build weirdness: `cd android && .\gradlew clean` then retry

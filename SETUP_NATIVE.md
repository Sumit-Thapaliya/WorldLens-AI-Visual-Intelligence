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

## Getting real detections

The native inference path is **implemented** (`InferenceModule.kt` runs ONNX Runtime Mobile
with thresholding + per-class NMS). The only missing piece is the model file itself - it is
not in the repo because it is ~3-5 MB.

### 1. Generate the model

```bat
cd worldlens
python ai/scripts/convert_model.py
```

This downloads the pretrained SSDLite-MobileNetV3 COCO model, exports it to ONNX, quantizes
it to int8, and writes **all** of these into `ai/../mobile/assets/models/object_detector/`:

| File | Purpose |
|---|---|
| `model.quant.onnx` | canonical name the app looks for first (a copy of the int8 build) |
| `ssdlite_int8.onnx` | the quantized model |
| `ssdlite.onnx` | the full-precision model |
| `labels.txt` | 91-entry category list, indices matching the model output |

### 2. Which filename the app accepts

`InferenceModule.kt` probes these in order and loads the first one present:

```
model.quant.onnx, ssdlite_int8.onnx, ssdlite.onnx, ssdlite_mobilenet_v3.onnx, yolov5n.onnx
```

So you can simply copy whichever `.onnx` you produced into
`mobile/assets/models/object_detector/` - no code change needed.

### 3. Rebuild - it self-configures

```bat
cd mobile
powershell -ExecutionPolicy Bypass -File .\apply-fixes.ps1 -Build
```

At runtime the module reads the input size and layout (NCHW vs NHWC) **from the model**, so a
300x300 or 320x320 export both work. Check the logcat tag `WorldLens-Inference`:

```
I WorldLens-Inference: Model ready: model.quant.onnx (3124 KB)
I WorldLens-Inference: Input 'input' shape=[1, 3, 320, 320] -> using 320x320 NCHW
```

### 4. If the model is missing, nothing breaks

`isModelLoaded()` returns false, the JS layer logs
`[WorldLens] detector: mock (no .onnx model in assets yet)` and the simulated detections keep
the UI usable. Add the model and it switches to real inference automatically - there is no
flag to flip.

### Notes on correctness

- Input is scaled to **0..1 only**. The exported torchvision graph applies its own ImageNet
  mean/std normalization internally, so normalizing here as well would badly degrade results.
- Boxes come back in **input pixels** (0..320), not 0..1; the post-processor detects the units
  and rescales, and clamps to the frame.
- Labels are mapped through COCO's 91-entry index space (class 62 is `chair`), not a naive
  `labels[id - 1]` lookup.
- The frame is stretched to the model's square input rather than centre-cropped so the returned
  boxes stay valid across the whole preview.

## Troubleshooting

- `SDK location not found`: create `mobile/android/local.properties` with
  `sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk`
- Reanimated build errors: make sure JDK 17 is the one on PATH (not 11/20)
- Build weirdness: `cd android && .\gradlew clean` then retry

<div align="center">

<img src="preview/assets/logo.jpg" alt="WorldLens — an AI that sees through your camera" width="760" />

# 👁️ WorldLens

**An AI that sees the world through your phone's camera — and never sends a single frame off the device.**

Point your phone at a room, a street, a person, a shelf. WorldLens draws a box around what it
finds, names it, keeps track of it as you move, counts it, tells you where it is, and answers you
out loud when you ask what it's looking at.

No internet. No cloud. No account. The model lives inside the app and runs on the phone itself.

<br>

![Platform](https://img.shields.io/badge/platform-Android%207.0%2B-3ddc84?style=flat-square&logo=android&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-0.73.4-61dafb?style=flat-square&logo=react&logoColor=white)
![Kotlin](https://img.shields.io/badge/Kotlin-native%20modules-7f52ff?style=flat-square&logo=kotlin&logoColor=white)
![ONNX Runtime](https://img.shields.io/badge/ONNX%20Runtime-1.16.3-005ced?style=flat-square&logo=onnx&logoColor=white)
![Model](https://img.shields.io/badge/model-SSDLite%20%2B%20MobileNetV3-c9a45c?style=flat-square)
![Offline](https://img.shields.io/badge/inference-100%25%20on--device-4fd1c5?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)

</div>

---

## 📖 What WorldLens is

Most "AI camera" apps are a thin client for a server somewhere: your photo gets uploaded, a GPU
farm looks at it, and an answer comes back a second later. WorldLens does the opposite. It carries
its own model — about 14 MB — and does all of the thinking on the phone's CPU, while the camera is
still open, before you've even decided what to point it at.

That constraint shapes everything about the app. It's why the model is small and efficient rather
than big and accurate. Why the camera, the model, and the interface each live on their own thread so
nothing janks. And why the app works in a basement, on a plane, or in a place with no signal at all.

**In one sentence:** it's a small, private, always-available pair of eyes that can name what it sees.

### Who it's for

The original motivation was **assistive vision** — a tool that can describe a scene out loud to
someone who can't see it well, or answer "how many people are in this room?" without a screen.
The counting, the spoken answers and the "find the bottle for me" mode all come from that idea.
It's equally useful as a demonstration of what a modern phone can do on its own.

---

## ✨ What it can do

| | Feature | In plain words |
|---|---|---|
| 🎯 | **Live detection** | Draws a labelled box around each of 80 everyday object types as you move the camera — person, car, bottle, chair, dog, phone, laptop, cup, and so on. |
| 🔢 | **Counting & tracking** | Each object keeps the same ID from frame to frame, so a person walking across the room stays *one* person instead of flickering into five. Counts are stable, not jumpy. |
| 🔎 | **Find an object** | Say or type *"find a bottle"* — the app keeps looking, highlights it when it appears, and tells you which way to turn. |
| 📍 | **Where things are** | For each object: left / centre / right, near / far, and a rough distance in metres. |
| 🏠 | **Scene understanding** | Reads the whole collection of objects and guesses the setting — kitchen, office, classroom, street, bedroom, park, restaurant, bathroom, store, outdoors. |
| 🎤 | **Voice, both ways** | Ask *"what do you see?"*, *"how many people are there?"*, *"where am I?"*, *"find a chair"*, *"stop"* — and hear the answer spoken back. |
| 🏷️ | **AR-style overlay** | Boxes, labels and confidence scores drawn over the live camera feed, styled to the app's theme. |
| 📴 | **Fully offline** | Nothing is uploaded. There's no analytics, no login, and no server-side component to turn off. |

---

## 🧠 How it works

WorldLens is a pipeline. Each stage does one job and hands off to the next — and the whole thing
runs dozens of times per second.

```
   ┌──────────────┐   ┌──────────────┐   ┌────────────────┐   ┌──────────────┐
   │   CAMERA     │──▶│  DETECTOR    │──▶│   TRACKER      │──▶│  INTERFACE   │
   │              │   │              │   │                │   │              │
   │ CameraX pulls│   │ 320×320 →    │   │ Matches boxes  │   │ Boxes, counts│
   │ frames off   │   │ neural net → │   │ to last frame's│   │ scene, voice,│
   │ the sensor   │   │ decoded boxes│   │ IDs, counts    │   │ spatial hints│
   └──────────────┘   └──────────────┘   └────────────────┘   └──────────────┘
      native thread      native thread        JavaScript           JavaScript
```

### 1. The eye — getting frames that actually arrive

The camera is handled in Kotlin with **CameraX**. It runs two things at once: a *preview* stream,
which is what you see, and an *analysis* stream, which is a second, smaller copy of the same scene
that the AI is allowed to look at. The analysis stream is deliberately configured to keep only the
newest frame and throw the rest away — if the model is busy, the app skips ahead to the latest
picture rather than falling behind in a queue of stale ones.

> **This is where the app spent most of its debugging life.** CameraX's own `PreviewView` reported
> a surface of `0 × 0` inside this particular view hierarchy — the camera bound successfully, asked
> for a surface, and then simply never delivered a single frame. No error, no crash, just a black
> rectangle. The fix was to stop using `PreviewView` and own a plain `TextureView`, handing its
> surface to CameraX directly so the app controls exactly when it's created, provided and released.

### 2. The brain — what happens to a frame

Each analysis frame is handed straight to the native side, converted to an RGBA bitmap, squashed to
**320 × 320**, and pushed through an ONNX neural network. The network returns thousands of candidate
boxes; the app keeps only the confident ones, then runs **non-maximum suppression** to collapse
overlapping duplicates into one clean box per object.

Detection happens entirely on the native camera thread — the JavaScript side never blocks on it.

### 3. The memory — how a "thing" stays the same thing

A raw detector has no memory. Frame one, there's a person at *x=400*. Frame two, at *x=410*. As far
as the network is concerned, those are two unrelated events.

So after every detection the results are matched against the previous frame's results by how much
their boxes overlap — the same trick that makes multi-object tracking work — and each surviving
object is issued a stable ID. New boxes get new IDs, boxes that stop appearing are retired after a
few missed frames. That's what turns flickering detections into **"3 people"** — and it's also what
lets the app remember which object you asked it to find.

### 4. The voice — asking out loud

Speech recognition and text-to-speech both come from Android itself, wrapped in a small Kotlin
module. Your sentence is matched against a small set of intents — *what do you see*, *how many*,
*find*, *describe the scene*, *stop* — and answered using the objects currently on screen. The reply
is spoken, and the relevant object is highlighted on screen so you can see as well as hear it.

### 5. Why it can all be offline

The model is picked to fit in a phone: **SSDLite with a MobileNetV3 backbone**, the lightweight
branch of the SSD family, at 320 × 320 input. It's a fraction of the size of a server-grade
detector and fast enough to run continuously on a CPU, which is exactly the trade-off an on-device
app needs.

---

## 🔨 How it was made

### Three layers, each doing what it's good at

| Layer | Language | Responsibility |
|---|---|---|
| **Interface** | React Native + TypeScript | Screens, navigation, the detection overlay, the tracker, scene logic, voice intent handling. Everything you see and every decision the app makes about *meaning*. |
| **Device** | Kotlin | The camera, the neural network runtime, speech, and the bridge that connects the two worlds. Everything that must be fast, or must touch hardware. |
| **Model** | Python (setup-time only) | Turning a pretrained model into a mobile-ready `.onnx` file. Not shipped, not needed to run the app. |

The split isn't arbitrary. Inference had to be native because JavaScript can't drive a camera
sensor or call into a C++ runtime without a huge performance cost. Tracking and scene logic stayed
in JavaScript because they change often and don't need to be fast to the microsecond. The boundary
between them is deliberately thin: **one call to get results, one to configure, one to release.**

### The model journey

The detector didn't start as an ONNX file. It was chosen and converted:

```
 PyTorch pretrained model  →  exported to ONNX  →  validated on COCO  →  shipped in the APK
        (SSDLite)              320×320, opset    mAP + latency      14 MB, loaded at runtime
                               tuned for CPU      benchmarked        from the app's own assets
```

Two ONNX variants sit in the repo — a **float** model and an **INT8-quantised** one about a third
of the size. The quantised model is the tempting choice on paper. In practice, on this runtime, it
**abort-checks at session creation** (the OS kills the process inside `libonnxruntime`, which cannot
be caught from Kotlin, because the failure happens in native code). So the app tries the float model
first and treats quantisation as an optimisation to revisit, not a requirement. That decision is
documented in the code so nobody "helpfully" flips it back.

### The threading decision that defines the app

The most important design choice is invisible when you use it: **inference does not run on the
thread that draws the screen, and it does not run on the thread that runs JavaScript.** It runs on
the camera's own analysis thread. JavaScript asks, up to twenty times a second, *"what do you have
for me?"* and gets the latest answer instantly, without ever waiting for a frame to be processed.

This is why the interface stays smooth while the model is working, and why a slow frame degrades
into a dropped frame rather than a frozen app.

### The four hard problems

Building it wasn't straightforward. These are the ones that actually took time, kept here because
they're the interesting part of the project:

**1. A camera that bound perfectly and showed nothing.**
CameraX reported success, requested a surface, and delivered zero frames. The cause was the
framework's own preview view collapsing to zero size inside the app's view hierarchy. Solved by
owning the `TextureView` and providing the surface manually — which also meant the app became
responsible for the surface's whole lifecycle, and that led directly to problem three.

**2. A crash the moment you took a photo.**
Capturing triggered a navigation change, which detached the camera view. The framework destroyed the
surface, and CameraX — still holding a reference to it — tried to use it a quarter of a second
later. The fix is subtle and counter-intuitive: the view must tell the framework *"don't free this
yet, I'm still using it"* and then release the surface itself once the camera has actually let go.

**3. A crash inside the neural network, with no Java exception to catch.**
Crash logs showed a segmentation fault on the camera thread, deep inside the C++ runtime, with a
null-pointer dereference. The cause was a race: when the scanner screen closed, the JavaScript
thread closed the model session — while the camera thread was still halfway through running an
inference on it. Safety flags weren't enough, because they were only checked *before* the long
native call started. Solved with a lock the analysis path can try to take and skip a frame rather
than wait, and which the teardown path waits on for up to two seconds before giving up.

**4. A model that killed the app at startup.**
The runtime offers hardware acceleration (NNAPI). On this device it doesn't fail gracefully — the
process aborts inside native code. The fix was to run on the CPU unconditionally with a conservative
optimisation level, measured as fast enough anyway for a model this size.

All four are the same lesson in different clothes: **on mobile, the lifecycle is the hard part, not
the maths.**

---

## 🧰 Built with

| | |
|---|---|
| **App framework** | React Native 0.73.4, React 18.2, TypeScript 5.3 |
| **Native** | Kotlin, Android SDK 34, minSdk 24 (Android 7.0), Gradle 8.6 |
| **Camera** | AndroidX CameraX 1.3.1 (preview + image analysis) |
| **AI runtime** | ONNX Runtime for Android 1.16.3 (CPU) |
| **Model** | SSDLite + MobileNetV3-Large, 320×320, COCO classes |
| **Speech** | Android `SpeechRecognizer` + `TextToSpeech` |
| **Model tooling** | Python, PyTorch, ONNX, ONNX Runtime (dev-time only) |

---

## 📁 What's in the repository

```
WorldLens/
│
├── mobile/                              The Android app
│   ├── App.tsx                          Entry point (+ a top-level error boundary)
│   ├── src/
│   │   ├── screens/                     Splash, Dashboard, Scanner, FindObject, Results, Settings
│   │   ├── components/                  Camera preview, detection boxes, labels, voice indicator
│   │   ├── hooks/                       useCamera, useDetection, useTracking, useVoice
│   │   ├── services/
│   │   │   ├── detection/               Talks to the native model
│   │   │   ├── tracking/                The IoU tracker that gives objects stable identities
│   │   │   ├── scene/                   Turns a list of objects into a guess about the room
│   │   │   └── voice/                   Turns a spoken sentence into an intent
│   │   ├── theme/                       Colours and type, shared by every screen
│   │   └── utils/                       Box geometry, confidence formatting, spatial hints
│   ├── android/
│   │   └── app/src/main/java/com/worldlens/
│   │       ├── camera/                  CameraX + the custom TextureView surface
│   │       ├── ml/                      ONNX Runtime: loading, preprocessing, NMS
│   │       ├── tracking/                Native tracker module
│   │       ├── voice/                   Speech recognition + text-to-speech
│   │       └── native/                  Where the four modules are registered
│   └── assets/models/object_detector/   The model and its 80 class labels — shipped in the APK
│
├── ai/                                  How the model was made (setup-time only)
│   ├── scripts/convert_model.py         Downloads the pretrained model, exports and quantises to ONNX
│   ├── scripts/evaluate.py              Accuracy (mAP) measurement
│   └── scripts/benchmark.py             Speed comparison between model variants
│
├── preview/                             A single-file, browser-only simulation of the app
│   ├── index.html                       Open it and the whole UI runs with simulated detections
│   └── assets/                          The WorldLens logo and icon artwork
│
├── docs/
│   ├── architecture.md                  How the pieces fit together
│   ├── ai-pipeline.md                   Model selection, conversion and evaluation
│   ├── mobile-inference.md              The runtime setup on device
│   └── features.md                      Every feature, in detail
│
├── START_HERE.md                        The fastest way to see it running
├── SETUP_NATIVE.md                      Notes on the native project setup
├── CONTRIBUTING.md                      How to build it and what's useful to contribute
└── CHANGELOG.md                         What changed, and what's known to be limited
```

---

## 🚀 Getting it running

### Fastest — see the interface in ten seconds

Nothing to install. Open **`preview/index.html`** in any browser (double-click it, or use VS Code's
Live Server). It's a complete, interactive simulation of the app — moving detections, AR boxes,
stable counts, find-object mode, scene detection, the results screen and settings. It shares the
logic of the real app but fakes the camera, which makes it a great way to see the design without an
Android build.

### Properly — build the Android app

**What you need:** Node.js 18+, JDK 17, and the Android SDK (platform 34 + build tools). An
Android 7.0 or newer device or emulator.

```bash
cd mobile
npm install                     # install the JavaScript dependencies
npx react-native bundle \       # bake the JavaScript into the app
  --platform android --dev false --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res

cd android
./gradlew assembleRelease       # build a self-contained APK
```

On Windows, use `gradlew.bat` instead of `./gradlew`. The APK lands in
`android/app/build/outputs/apk/release/app-release.apk` — install that file.

> **Use a release build.** A *debug* build doesn't contain the JavaScript at all; it downloads it
> from a development server while you work, so it shows an "unable to load script" screen unless
> that server is running. A *release* build has everything baked in and needs nothing external.
> That distinction is the single most common reason a React Native app "doesn't work" on a phone.

The model is already in the repository, so there's nothing to download and no Python step required.

---

## 🔬 The model, in numbers

| | |
|---|---|
| Architecture | SSDLite with a MobileNetV3-Large backbone |
| Input | 320 × 320 RGB |
| Classes | 80 COCO object types (91 label slots including the background class) |
| Size on disk | ≈ 14 MB (float) / ≈ 4.3 MB (INT8 variant, kept but not loaded) |
| Execution | CPU only, conservative graph optimisation, 4 threads |
| Confidence cut-off | 0.45 |
| Overlap cut-off (NMS) | 0.5 |
| Max objects per frame | 20 |
| Detection rate | up to 20 results per second, decoupled from camera frame rate |

<details>
<summary><b>Why the float model and not the quantised one?</b></summary>

<br>

The INT8 model is roughly a third of the size and should be faster. On this device and this runtime
build it fails at session creation and takes the whole process down inside native code — a failure
that cannot be caught in Kotlin, because it happens below the language boundary. The float model is
the reliable choice, and at this model size CPU inference is fast enough that quantisation isn't
needed for a good experience. The code tries the float model first and documents the reasoning; a
different runtime version or device may well make INT8 the better option.

</details>

---

## 📊 Performance notes

- Detection results refresh up to **20 times a second**, while the camera preview runs at its own
  higher rate — the two aren't tied together.
- Inference never runs on the UI or JavaScript thread, so tracking, animation and voice stay
  responsive regardless of how long a frame takes.
- If a frame is slow, the analysis stream **drops it** rather than queueing it, so latency doesn't
  build up behind a backlog.
- Tracking and scene classification are pure JavaScript and cost fractions of a millisecond.

Actual frame rates depend on the device. On a mid-range phone the detector comfortably keeps up with
the refresh rate above; the visible limit is usually the detector's confidence, not the CPU.

---

## 🔒 Privacy

This is the part of the design that isn't negotiable:

- **No network permission is used for inference.** Camera frames go from the sensor to the model to
  the screen, and nowhere else.
- **Nothing is stored.** No images are saved unless you explicitly capture one.
- **No accounts, no analytics, no tracking, no ads, no third-party services.**
- **No model downloads at runtime.** The model is inside the APK, so installing the app is the last
  time it ever needs a connection.

---

## 🗺️ Where it could go next

- [ ] Run on the **GPU / NPU** where the hardware and runtime allow it, and revisit the INT8 model
      alongside it
- [ ] **Multiple detection frames per second on screen** — smoother boxes through interpolation
      between inferences
- [ ] **Depth estimation** for real distances instead of the current apparent-size estimate
- [ ] **Text and barcode reading** for a genuine "what does this sign say?" mode
- [ ] **Better accessibility output** — continuous narration, haptic feedback for direction
- [ ] **Recognition of your own objects** — a few photos to teach it something personal
- [ ] **iOS build** — the native layer is currently Android-only

---

## 🤝 Contributing

Ideas, bug reports and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for how to
set up a development build and what's most useful.

---

## 📄 License

Released under the [MIT License](LICENSE) — use it, learn from it, build on it.

---

<div align="center">

**WorldLens** — seeing, understanding and speaking, entirely on the device in your pocket.

<sub>Built as a study in on-device computer vision: a small model, a lot of engineering, and
nothing leaving the phone.</sub>

</div>
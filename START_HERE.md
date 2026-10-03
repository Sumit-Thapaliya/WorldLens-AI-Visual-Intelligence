# 🚀 How to Run WorldLens — Quick Start

## ⚡ Option 1: See the app instantly (no installs needed — 10 seconds)

You don't need Android Studio, React Native, npm, or Python **at all** to see the app working.

1. Open the folder in VS Code.
2. Find the file **`preview/index.html`** in the left sidebar.
3. **Right-click it → "Open with Live Server"** (if you have the Live Server extension), OR just double-click it in your file explorer — it will open directly in your browser.
4. That's it! The fully interactive premium UI is running.

> The preview is a complete simulation of the app: live moving detections, AR boxes, tracking counts, find-object mode, voice commands (uses your browser's microphone if you allow it), scene detection, result screen, and settings.

---

## 📱 Option 2: Work on the React Native / TypeScript source

This is the **actual mobile app code** that runs on Android devices.

### What you need installed first:
- [Node.js](https://nodejs.org/) 18+ (LTS recommended)
- [Android Studio](https://developer.android.com/studio) (for the Android SDK & emulator)
- [Python 3.10+](https://www.python.org/) (only if you want to work with the AI model scripts)

### Commands:

```bash
# 1. Go into the mobile folder
cd mobile

# 2. Install dependencies (only needed ONCE, or when package.json changes)
npm install

# 3. Start the Metro bundler
npm start

# 4. In a second terminal (with an Android emulator running or a device connected):
npm run android
```

---

## 🤖 Option 3: Convert the AI model (optional)

The app works with a pretrained SSDLite MobileNetV3 model. To export it from PyTorch → ONNX for the phone:

```bash
cd ai
pip install -r requirements.txt
python scripts/convert_model.py --model ssdlite --output ../mobile/assets/models/object_detector/
```

You don't need to do this unless you want to regenerate the `.onnx` model file. The labels file (`labels.txt`) is already included.

---

## 📂 What's what

| Path | What it is | Needs install? |
|------|-----------|----------------|
| `preview/index.html` | **Working interactive demo** (double-click to open) | ❌ No |
| `mobile/` | React Native + TypeScript source code | ✅ `npm install` in `mobile/` |
| `mobile/android/` | Kotlin native modules (CameraX, ONNX, Voice) | Requires Android SDK |
| `ai/` | Python scripts for model conversion | `pip install -r ai/requirements.txt` |
| `docs/` | Architecture & AI pipeline documentation | ❌ No |
| `README.md` | Full project docs | ❌ No |

---

## 🎯 The fastest path to "I want to see it working now"

Just open **`preview/index.html`** in any modern browser. It's the complete premium UI with all animations, simulated real-time AI detection, voice commands, find-mode, AR labels, scene understanding — everything.

No command line. No installs. No servers.

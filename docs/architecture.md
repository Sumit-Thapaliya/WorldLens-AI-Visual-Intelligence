# WorldLens Architecture

## Overview

WorldLens is a mobile AI reality scanner that performs on-device real-time object detection, tracking, scene understanding, and voice interaction. The architecture follows three layers:

```
┌─────────────────────────────────────────────────────┐
│  React Native / TypeScript (UI & State)            │
│  - Screens, components, hooks                      │
│  - Detection/tracking/scene/voice services         │
│  - AR-style overlays & navigation                  │
└────────────────┬────────────────────────────────────┘
                 │ Native Module bridge (JNI / RN Bridge)
┌────────────────▼────────────────────────────────────┐
│  Kotlin / Android Native                           │
│  ├── CameraModule    — CameraX frame producer      │
│  ├── InferenceModule — ONNX Runtime Mobile         │
│  ├── TrackingModule  — Native IoU tracker (opt.)   │
│  └── VoiceModule     — SpeechRecognizer + TTS      │
└─────────────────────────────────────────────────────┘
                 ▲
                 │ Model files (.onnx, labels.txt)
┌────────────────┴────────────────────────────────────┐
│  Python AI Tooling (dev-time only)                  │
│  - Model selection, evaluation, quantization        │
│  - Conversion from PyTorch → ONNX for mobile        │
│  - Benchmarking                                     │
└─────────────────────────────────────────────────────┘
```

## Design Principles

1. **On-device first.** Core detection loop runs entirely on the phone. No camera data leaves the device.
2. **No required backend.** No database, no authentication, no API calls for normal operation.
3. **Offline capable.** The model is bundled with the APK; app works without internet.
4. **Pretrained models only.** SSDLite MobileNetV3-Large (COCO) for detection. No custom dataset or training required for v1.
5. **Layered performance.** The JS layer provides tracker/scene/command logic; the Kotlin layer handles heavy frame processing and ML inference.

## Data Flow (per frame)

```
CameraX ImageAnalysis
        │
        ▼
InferenceModule.analyzeFrame()
        │  (preprocess → ONNX run → NMS)
        ▼
Detections (label, confidence, box)
        │
        ▼ (emitted to JS via polling or events)
useDetection.processFrame()
        │
        ▼
sortTracker (IoU-based SORT-like association)
        │
        ├──► objectCounts (per-class counts from active tracks)
        ├──► sceneClassifier (object co-occurrence heuristics)
        ├──► findMode (match against target label + direction/distance)
        └──► CameraOverlay (bounding boxes + AR labels)
```

## Module Responsibilities

### React Native / TypeScript

| Path | Purpose |
|------|---------|
| `src/screens/` | Home, Scanner, FindObject, Results, Settings screens |
| `src/components/` | DetectionBox, ObjectLabel, CameraOverlay, DetectionList, VoiceIndicator |
| `src/hooks/` | useCamera, useDetection, useTracking, useVoice |
| `src/services/detection/` | Detector handle (native + mock) |
| `src/services/tracking/` | SORT-like IoU tracker |
| `src/services/scene/` | Scene classification (heuristic + model interface) |
| `src/services/voice/` | Command parsing + response generation |
| `src/utils/` | Coordinate conversion, confidence formatting, spatial heuristics |

### Kotlin / Android

| Class | Purpose |
|-------|---------|
| `MainActivity` / `MainApplication` | RN host activity + module registration |
| `CameraModule` | CameraX lifecycle, preview, analysis frame dispatch |
| `InferenceModule` | ONNX Runtime session, preprocess, inference, NMS |
| `ModelRunner` | Stateless NMS + box decoding utilities |
| `TrackingModule` | Optional high-performance native tracker |
| `VoiceModule` | SpeechRecognizer (STT) + TextToSpeech |
| `NativeModulePackage` | Registers all native modules with React Native |

### Python (development)

| Script | Purpose |
|--------|---------|
| `convert_model.py` | Converts PyTorch pretrained model → ONNX (with int8 quantization) |
| `evaluate.py` | Evaluates model mAP, runs inference benchmarks |
| `benchmark.py` | Compares model architectures for mobile suitability |

## Key Technical Decisions

- **Model choice:** SSDLite MobileNetV3-Large 320x320 (~12 MB) — strong speed/accuracy trade-off for CPU inference on mid-range Android. YOLOv5n is also supported in Python tooling.
- **Tracking:** IoU-based SORT-like tracker with per-class matching, min-hits/max-age gating. Simple, fast, runs at frame rate.
- **Scene understanding:** Heuristic co-occurrence classifier for v1 (zero model cost), with architecture ready to accept a dedicated Places365/MobileNet classifier plugged in via the native ML layer.
- **Voice:** Native Android SpeechRecognizer + TTS. Command parsing done in JS for easy iteration.
- **Spatial awareness:** Bounding-box size + center position drive approximate distance/zone classification. Presented as approximate (no precise depth claims without depth hardware).

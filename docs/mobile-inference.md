# Mobile Inference Setup

## Runtime: ONNX Runtime Mobile

WorldLens uses ONNX Runtime Mobile for on-device inference. It provides:
- CPU execution by default (good compatibility).
- NNAPI EP (Android) for GPU/NPU acceleration when available.
- Small binary footprint (~5 MB).
- Support for dynamic quantization (INT8).

## Generating the model

```bash
cd ai/
pip install -r requirements.txt
python scripts/convert_model.py --model ssdlite --output ../mobile/assets/models/object_detector/
```

This produces:
- `ssdlite.onnx` — full FP32 model.
- `ssdlite_int8.onnx` — dynamically quantized INT8 model (preferred for mobile).
- `labels.txt` — 80 COCO class labels.

## Loading the model on Android

In `InferenceModule.kt`:
1. Read `.onnx` bytes from assets.
2. Create `OrtEnvironment` + `OrtSession.SessionOptions()`.
3. Call `sessionOptions.addNnapi()` (fall back to CPU if NNAPI fails).
4. Create session once; reuse for every frame.

## Preprocessing performance tips

- Resize camera frame to model input size (320) using RenderScript/HardwareBitmap where possible.
- Reuse tensor buffer across frames (do not allocate new FloatBuffer per frame).
- Run preprocessing and post-processing off the UI thread (CameraX analysis executor).

## Target performance

| Device tier | Input size | CPU latency | FPS target |
|-------------|-----------|-------------|-----------|
| High-end (Snapdragon 8 series) | 320 | 15-25 ms | 30+ FPS |
| Mid-range (Snapdragon 6/7 series) | 320 | 30-50 ms | 15-25 FPS |
| Low-end (Snapdragon 4 series) | 320 INT8 | 50-80 ms | 10-15 FPS |

If FPS drops below 15 on a device, consider:
1. Switching to the INT8-quantized model.
2. Reducing input resolution to 224 (requires re-exporting).
3. Running detection every other frame and interpolating with the tracker.

## Threading model

```
CameraX analysis thread
    └── InferenceModule.analyzeFrame()
        ├── Preprocess (resize + normalize)
        ├── ortSession.run()
        └── Post-process (NMS)
            └── write latestDetections (atomic reference)

JS thread (requestAnimationFrame loop at target FPS)
    └── useDetection.processFrame()
        ├── Read latestDetections
        ├── Run JS tracker
        └── Update React state
```

This ensures a slow inference pass never blocks the UI.

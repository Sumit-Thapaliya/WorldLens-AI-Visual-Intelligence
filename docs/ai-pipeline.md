# AI Pipeline

## Object Detector

**Model:** SSDLite with MobileNetV3-Large backbone (torchvision implementation), or YOLOv5n.

**Input:** RGB image resized to 320×320 (SSDLite) or 640×640 (YOLOv5n), normalized to [0, 1].

**Outputs:**
- Bounding boxes in (cx, cy, w, h) format — converted to normalized (x, y, w, h).
- Class scores for 80 COCO categories.
- Class labels via argmax + confidence threshold.

**Post-processing:**
1. Filter boxes with score < confidence threshold (default 0.45).
2. Decode boxes to RectF.
3. Apply per-class Non-Maximum Suppression (IoU threshold 0.45).
4. Return top-N (default 20) detections.

**Quantization:** Dynamic INT8 quantization via ONNX Runtime reduces model size (~4×) and improves CPU latency with minimal accuracy loss.

## Tracker

SORT-inspired IoU tracker (no Kalman filter for v1 — IoU alone handles small inter-frame motion at 20+ FPS).

- **Matching:** Greedy highest-IoU pairing restricted to same-class boxes; IoU threshold 0.3.
- **Confirmation:** Track becomes active after minHits=2 consecutive detections (reduces false positives).
- **Deletion:** Track is removed after maxAge=15 missed frames.
- **Output:** Active tracks carry a stable `trackingId`, age, position history.

## Scene Classifier

Two-stage:

1. **Heuristic co-occurrence (default, zero cost):** Scores scenes (kitchen, office, street, …) by how many detected object labels match each scene's signature. Produces a probability distribution and a majority-vote smoothed output over a 15-frame window to avoid flickering.
2. **Optional dedicated classifier:** Swap in a MobileNet Places365 model via `InferenceModule` for higher accuracy — the TypeScript `ScenePrediction` interface is model-agnostic.

## Spatial Estimation

Bounding-box geometry drives approximate spatial cues:

- **Horizontal zone:** center-x in [0, 0.35) → left; [0.35, 0.65] → center; (0.65, 1] → right.
- **Vertical zone:** similarly thirds of the y-axis.
- **Distance:** Bounding box area (normalized) is bucketed into close / medium / far with rough meter estimates calibrated for typical phone-holding distances. Clearly labeled as approximate.

## Voice Commands

Parsed with pattern-matching over ASR output. Supported commands:

| Pattern | Command |
|---------|---------|
| "find/locate/where is … X" | find_object(X) |
| "how many/count … X" | count(X) |
| "what do you see" | what_do_you_see |
| "where am I / what is this place" | describe_scene |
| "stop/cancel/done" | stop search |

Label matching uses a synonym table to map spoken phrases (e.g., "people", "guy", "mobile") to canonical COCO labels.

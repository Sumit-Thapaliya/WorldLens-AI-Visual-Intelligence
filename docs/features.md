# Feature Reference

## Feature 1 — Real-time Object Detection
- Pretrained SSDLite MobileNetV3 detects 80 COCO classes.
- Bounding boxes, class labels, confidence scores drawn on camera preview.
- Runs at 15-30 FPS on device.
- Dev overlay shows FPS, inference time, model name.

## Feature 2 — Object Tracking
- IoU-based tracker assigns stable IDs to detections.
- Tracks objects across frames; labels follow moving objects.
- Min-hits gating reduces false positives.
- Max-age grace period handles brief occlusions.

## Feature 3 — Object Counting
- Counts derived from active tracks (not per-frame detections).
- Shows per-class pill list (e.g., "4 person", "2 chair").
- Prevents double-counting the same object.

## Feature 4 — Find Object Mode
- Enter from Home screen or Scanner ("Find" button, or voice).
- Search by typing, quick-select chips, or voice.
- Highlight target object with a blue bounding box.
- Reports direction (left/right/center) and approximate distance.
- Continuous scanning until object is found.

## Feature 5 — Scene Understanding
- Classifies environment: Kitchen, Office, Classroom, Street, Bedroom, Park, Living Room, Restaurant, Bathroom, Store.
- Uses object co-occurrence heuristics with temporal smoothing.
- Architecture supports swapping in a dedicated scene-classification model.

## Feature 6 — Spatial Awareness
- Divides camera view into left/center/right zones.
- Bounding-box size drives approximate distance (close/medium/far) with meter estimates.
- Clearly labeled as approximate.

## Feature 7 — Voice Interaction
- Uses native Android SpeechRecognizer + TextToSpeech.
- Recognizes commands:
  - "What do you see?"
  - "How many people/bottles/cars are there?"
  - "Find a bottle/chair/person."
  - "Where am I?" / "Describe the scene."
  - "Stop."
- Responds with natural spoken language based on current detection state.
- Never claims knowledge beyond what the vision system actually sees.

## Feature 8 — AR-Style Labels
- Detection boxes drawn at screen coordinates overlaid on the camera preview.
- Labels (class + confidence) sit above each box with confidence-based coloring.
- Labels follow tracked objects across frames.
- Screen-space AR — no ARCore required.

## Optional — Object Information Screen
- Tap Info on the scanner to see full details for the nearest/selected object.
- Shows confidence, position, distance, a short description from a local knowledge map, and actions (Track, Find Similar, Voice Explain).

## Privacy & Offline Guarantees
- All detection runs on-device; no camera frames leave the phone.
- No backend, no database, no account required for v1.
- Works completely offline once the app is installed.

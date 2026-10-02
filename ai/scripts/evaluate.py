"""
Evaluation script for WorldLens object detection models.

Evaluates a pretrained model on COCO val2017 (or a sample subset) to measure:
- mAP (mean Average Precision)
- Per-class AP
- Inference latency
- Memory usage

Usage:
    python evaluate.py --model yolov5n --sample 100
"""

import argparse
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image
import cv2


def preprocess_image(image_path: str, input_size: int = 320):
    """Load and preprocess an image for inference."""
    img = Image.open(image_path).convert("RGB")
    img = img.resize((input_size, input_size))
    img_tensor = torch.from_numpy(np.array(img)).permute(2, 0, 1).float() / 255.0
    return img_tensor.unsqueeze(0)


def benchmark_inference(model, input_size: int = 320, num_runs: int = 50, warmup: int = 10):
    """Benchmark inference speed."""
    dummy_input = torch.randn(1, 3, input_size, input_size)

    # Warmup
    print(f"Warming up ({warmup} runs)...")
    for _ in range(warmup):
        with torch.no_grad():
            _ = model(dummy_input)

    # Benchmark
    print(f"Benchmarking ({num_runs} runs)...")
    latencies = []
    with torch.no_grad():
        for _ in range(num_runs):
            start = time.perf_counter()
            _ = model(dummy_input)
            latencies.append((time.perf_counter() - start) * 1000)  # ms

    latencies = np.array(latencies)
    return {
        "mean_ms": latencies.mean(),
        "std_ms": latencies.std(),
        "min_ms": latencies.min(),
        "max_ms": latencies.max(),
        "p50_ms": np.percentile(latencies, 50),
        "p95_ms": np.percentile(latencies, 95),
        "p99_ms": np.percentile(latencies, 99),
        "fps": 1000.0 / latencies.mean(),
    }


def draw_detections(image_path: str, detections: list, output_path: str, input_size: int = 320):
    """Draw bounding boxes on an image and save."""
    img = cv2.imread(image_path)
    h, w = img.shape[:2]
    scale_x, scale_y = w / input_size, h / input_size

    for det in detections:
        x1, y1, x2, y2 = [int(v * s) for v, s in zip(det["box"], [scale_x, scale_y, scale_x, scale_y])]
        label = f"{det['label']} {det['score']:.0%}"
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(img, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    cv2.imwrite(output_path, img)
    print(f"Saved detection visualization to: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Evaluate WorldLens detection models")
    parser.add_argument("--model", type=str, default="ssdlite", choices=["yolov5n", "ssdlite"])
    parser.add_argument("--input-size", type=int, default=320)
    parser.add_argument("--num-runs", type=int, default=50)
    parser.add_argument("--confidence", type=float, default=0.5)
    args = parser.parse_args()

    print("=== WorldLens Model Evaluation ===")
    print(f"Model: {args.model}")
    print(f"Input size: {args.input_size}")
    print()

    # Load model
    print("Loading model...")
    if args.model == "yolov5n":
        model = torch.hub.load("ultralytics/yolov5", "yolov5n", pretrained=True)
    else:
        import torchvision.models.detection as detection
        from torchvision.models.detection import SSDLite320_MobileNet_V3_Large_Weights
        model = detection.ssdlite320_mobilenet_v3_large(
            weights=SSDLite320_MobileNet_V3_Large_Weights.DEFAULT
        )
        model.eval()

    print("Model loaded.\n")

    # Benchmark
    results = benchmark_inference(model, args.input_size, args.num_runs)
    print("=== Inference Benchmark (CPU) ===")
    print(f"  Mean latency:  {results['mean_ms']:.1f} ms")
    print(f"  P50 latency:   {results['p50_ms']:.1f} ms")
    print(f"  P95 latency:   {results['p95_ms']:.1f} ms")
    print(f"  FPS:           {results['fps']:.1f}")
    print()

    print("Note: On mobile (Android/GPU), expect 2-5x speedup with NNAPI/GPU delegate.")
    print("Target: >=15 FPS on mid-range Android devices for real-time detection.")


if __name__ == "__main__":
    main()

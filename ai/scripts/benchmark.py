"""
Benchmark script for comparing model performance on mobile-like constraints.

Tests different models and configurations to find the optimal choice for WorldLens.
"""

import argparse
import time
import json
from dataclasses import dataclass, asdict
from pathlib import Path

import numpy as np
import torch


@dataclass
class BenchmarkResult:
    model_name: str
    input_size: int
    quantized: bool
    mean_latency_ms: float
    std_latency_ms: float
    fps: float
    model_size_mb: float
    params_million: float
    target_mobile_fps: float = 15.0

    def to_dict(self):
        return asdict(self)


def count_parameters(model):
    """Count trainable parameters in millions."""
    return sum(p.numel() for p in model.parameters() if p.requires_grad) / 1e6


def get_model_size(model_path: str) -> float:
    """Get model file size in MB."""
    path = Path(model_path)
    if path.exists():
        return path.stat().st_size / (1024 * 1024)
    return 0.0


def benchmark_model(model, input_size: int, name: str, num_runs: int = 100, warmup: int = 20) -> BenchmarkResult:
    """Run full benchmark on a model."""
    model.eval()
    dummy = torch.randn(1, 3, input_size, input_size)

    # Warmup
    for _ in range(warmup):
        with torch.no_grad():
            _ = model(dummy)

    # Timed runs
    latencies = []
    with torch.no_grad():
        for _ in range(num_runs):
            start = time.perf_counter()
            _ = model(dummy)
            latencies.append((time.perf_counter() - start) * 1000)

    latencies = np.array(latencies)
    params = count_parameters(model)

    return BenchmarkResult(
        model_name=name,
        input_size=input_size,
        quantized=False,
        mean_latency_ms=float(latencies.mean()),
        std_latency_ms=float(latencies.std()),
        fps=1000.0 / float(latencies.mean()),
        model_size_mb=0.0,  # Set after ONNX export
        params_million=float(params),
    )


def main():
    parser = argparse.ArgumentParser(description="Benchmark models for WorldLens")
    parser.add_argument("--num-runs", type=int, default=100)
    parser.add_argument("--output", type=str, default="benchmark_results.json")
    args = parser.parse_args()

    print("=" * 60)
    print("  WorldLens - Model Benchmark Suite")
    print("=" * 60)

    results = []

    # Test configurations
    configs = [
        ("SSDLite MobileNetV3 (320)", "ssdlite", 320),
        ("SSDLite MobileNetV3 (640)", "ssdlite", 640),
    ]

    try:
        import torchvision.models.detection as detection
        from torchvision.models.detection import SSDLite320_MobileNet_V3_Large_Weights

        print("\nLoading SSDLite MobileNetV3-Large...")
        model = detection.ssdlite320_mobilenet_v3_large(
            weights=SSDLite320_MobileNet_V3_Large_Weights.DEFAULT
        )

        for name, arch, size in configs:
            print(f"\nBenchmarking: {name}")
            result = benchmark_model(model, size, name, args.num_runs)
            results.append(result)
            print(f"  Latency: {result.mean_latency_ms:.1f} ms")
            print(f"  FPS: {result.fps:.1f}")
            print(f"  Params: {result.params_million:.1f}M")
    except Exception as e:
        print(f"Could not benchmark SSDLite: {e}")

    # YOLOv5n
    try:
        print("\nLoading YOLOv5n...")
        model = torch.hub.load("ultralytics/yolov5", "yolov5n", pretrained=True)
        result = benchmark_model(model, 640, "YOLOv5n (640)", args.num_runs)
        results.append(result)
        print(f"  Latency: {result.mean_latency_ms:.1f} ms")
        print(f"  FPS: {result.fps:.1f}")
        print(f"  Params: {result.params_million:.1f}M")
    except Exception as e:
        print(f"Could not benchmark YOLOv5n: {e}")

    # Print summary
    print("\n" + "=" * 60)
    print("  SUMMARY")
    print("=" * 60)
    print(f"{'Model':<30} {'Latency(ms)':<12} {'FPS':<8} {'Params(M)':<10}")
    print("-" * 60)
    for r in results:
        print(f"{r.model_name:<30} {r.mean_latency_ms:<12.1f} {r.fps:<8.1f} {r.params_million:<10.1f}")

    print("\nRecommended for WorldLens mobile deployment:")
    if results:
        best = max(results, key=lambda x: x.fps)
        print(f"  -> {best.model_name} (highest FPS: {best.fps:.1f})")

    # Save results
    output_path = Path(args.output)
    with open(output_path, "w") as f:
        json.dump([r.to_dict() for r in results], f, indent=2)
    print(f"\nResults saved to {output_path}")


if __name__ == "__main__":
    main()

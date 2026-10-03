"""
Model conversion script for WorldLens.

Converts a pretrained PyTorch object detection model (YOLOv5n or SSDLite MobileNetV3)
to ONNX format suitable for on-device inference with ONNX Runtime Mobile.

Usage:
    python convert_model.py --model yolov5n --output ../mobile/assets/models/object_detector/
    python convert_model.py --model ssdlite --output ../mobile/assets/models/object_detector/
"""

import argparse
import os
import sys
from pathlib import Path

import torch
import torch.onnx


COCO_CLASSES = [
    "__background__", "person", "bicycle", "car", "motorcycle", "airplane", "bus",
    "train", "truck", "boat", "traffic light", "fire hydrant", "stop sign",
    "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow",
    "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag",
    "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball", "kite",
    "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
    "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana",
    "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza",
    "donut", "cake", "chair", "couch", "potted plant", "bed", "dining table",
    "toilet", "tv", "laptop", "mouse", "remote", "keyboard", "cell phone",
    "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock",
    "vase", "scissors", "teddy bear", "hair drier", "toothbrush",
]


def load_yolov5n(pretrained: bool = True):
    """Load YOLOv5n (nano) model - best balance of speed and accuracy for mobile."""
    try:
        model = torch.hub.load("ultralytics/yolov5", "yolov5n", pretrained=pretrained)
    except Exception:
        print("Falling back to torchvision SSDLite MobileNetV3 Large...")
        return load_ssdlite_mobilenet(pretrained)
    return model, 640


def load_ssdlite_mobilenet(pretrained: bool = True):
    """Load SSDLite with MobileNetV3-Large backbone from torchvision."""
    import torchvision.models.detection as detection
    from torchvision.models.detection import (
        SSDLite320_MobileNet_V3_Large_Weights,
    )

    weights = SSDLite320_MobileNet_V3_Large_Weights.DEFAULT if pretrained else None
    model = detection.ssdlite320_mobilenet_v3_large(weights=weights)
    model.eval()
    return model, 320


def convert_to_onnx(model, input_size: int, output_path: str, model_name: str):
    """Convert PyTorch model to ONNX format optimized for mobile."""
    model.eval()
    dummy_input = torch.randn(1, 3, input_size, input_size)

    onnx_path = os.path.join(output_path, f"{model_name}.onnx")

    print(f"Converting {model_name} to ONNX with input size {input_size}...")

    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        export_params=True,
        opset_version=12,
        input_names=["input"],
        output_names=["boxes", "scores", "labels"],
        dynamic_axes={
            "input": {0: "batch"},
            "boxes": {0: "batch"},
            "scores": {0: "batch"},
            "labels": {0: "batch"},
        },
        do_constant_folding=True,
        dynamo=False,
    )

    print(f"ONNX model saved to: {onnx_path}")

    # Verify the model
    import onnx
    onnx_model = onnx.load(onnx_path)
    onnx.checker.check_model(onnx_model)
    print("ONNX model verification passed.")

    # Try to optimize with onnxruntime if available
    try:
        from onnxruntime.quantization import quantize_dynamic, QuantType
        quantized_path = os.path.join(output_path, f"{model_name}_int8.onnx")
        quantize_dynamic(onnx_path, quantized_path, weight_type=QuantType.QInt8)
        print(f"Quantized model saved to: {quantized_path}")
    except Exception as e:
        print(f"Quantization skipped: {e}")

    return onnx_path


# The 91-entry category list the pretrained torchvision detection weights actually emit
# indices into. It contains 11 gaps: 5 named-but-unannotated classes (street sign, hat,
# shoe, eye glasses, plate) and 5 trailing N/A slots. Indices matter - class 62 is "chair"
# here, NOT the 62nd of the 80 real classes, so a plain labels[classId - 1] lookup
# mislabels everything after "fire hydrant".
COCO_91_CATEGORIES = [
    "__background__", "person", "bicycle", "car", "motorcycle", "airplane", "bus",
    "train", "truck", "boat", "traffic light", "fire hydrant", "street sign",
    "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep",
    "cow", "elephant", "bear", "zebra", "giraffe", "hat", "backpack", "umbrella",
    "shoe", "eye glasses", "handbag", "tie", "suitcase", "frisbee", "skis",
    "snowboard", "sports ball", "kite", "baseball bat", "baseball glove",
    "skateboard", "surfboard", "tennis racket", "bottle", "plate", "wine glass",
    "cup", "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich",
    "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
    "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop",
    "mouse", "remote", "keyboard", "cell phone", "microwave", "oven", "toaster",
    "sink", "refrigerator", "book", "clock", "vase", "scissors", "teddy bear",
    "hair drier", "toothbrush", "N/A", "N/A", "N/A", "N/A", "N/A",
]


def save_labels(output_path: str):
    """Save COCO class labels as a text file for mobile use.

    Writes the full 91-entry list (including "__background__" at index 0) so that
    `labels[class_id]` matches the model's output indices exactly. InferenceModule
    detects a 91-line file and uses it directly; for a legacy 80-line file it maps
    indices through the COCO gap table instead.
    """
    labels_path = os.path.join(output_path, "labels.txt")
    with open(labels_path, "w") as f:
        for label in COCO_91_CATEGORIES:
            f.write(f"{label}\n")
    print(f"Labels saved to: {labels_path} ({len(COCO_91_CATEGORIES)} entries)")
    return labels_path


def main():
    parser = argparse.ArgumentParser(description="Convert pretrained models for WorldLens")
    parser.add_argument(
        "--model",
        type=str,
        default="yolov5n",
        choices=["yolov5n", "ssdlite"],
        help="Model architecture to convert",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="../mobile/assets/models/object_detector",
        help="Output directory for converted models",
    )
    parser.add_argument(
        "--no-pretrained",
        action="store_true",
        help="Use random weights (for testing conversion only)",
    )
    args = parser.parse_args()

    output_path = Path(args.output)
    output_path.mkdir(parents=True, exist_ok=True)

    print(f"Selected model: {args.model}")

    if args.model == "yolov5n":
        model, input_size = load_yolov5n(pretrained=not args.no_pretrained)
    else:
        model, input_size = load_ssdlite_mobilenet(pretrained=not args.no_pretrained)

    onnx_path = convert_to_onnx(model, input_size, str(output_path), args.model)
    save_labels(str(output_path))

    # Ship a copy under the name the app + docs refer to, so the file that lands in
    # mobile/assets/models/object_detector/ is unambiguously "the model to use".
    # Prefer the quantized build when it exists (smaller + faster on mobile).
    quantized = Path(str(output_path)) / f"{args.model}_int8.onnx"
    preferred = quantized if quantized.exists() else Path(onnx_path)
    canonical = Path(str(output_path)) / "model.quant.onnx"
    try:
        import shutil

        shutil.copyfile(preferred, canonical)
        print(f"Canonical model written: {canonical}  (from {preferred.name})")
    except Exception as e:  # noqa: BLE001 - conversion must not fail on this step
        print(f"Could not create {canonical}: {e}")

    print("\n=== Conversion Complete ===")
    print(f"Model: {onnx_path}")
    print(f"Input size: {input_size}x{input_size}")
    print(f"Classes: {len(COCO_CLASSES) - 1} (COCO)")
    print("\nCopy the .onnx and labels.txt files to mobile/assets/models/object_detector/")
    print("For mobile, prefer the _int8 quantized version for faster inference.")


if __name__ == "__main__":
    main()

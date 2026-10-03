package com.worldlens.ml

import android.graphics.RectF
import kotlin.math.max
import kotlin.math.min

/**
 * ModelRunner - Standalone post-processing utilities (NMS, box decoding, label mapping).
 *
 * Extracted from InferenceModule so the maths can be unit-tested in isolation and so the
 * ONNX-specific code stays out of here (everything in this file is pure Kotlin + RectF).
 */
object ModelRunner {

    /**
     * Non-Maximum Suppression.
     * Greedily keeps boxes that have IoU < iouThreshold with already-selected boxes.
     */
    fun nonMaximumSuppression(
        boxes: List<RectF>,
        scores: FloatArray,
        labels: IntArray,
        scoreThreshold: Float,
        iouThreshold: Float
    ): List<Triple<RectF, Float, Int>> {
        val candidates = mutableListOf<Triple<RectF, Float, Int>>()
        for (i in boxes.indices) {
            if (scores[i] >= scoreThreshold) {
                candidates.add(Triple(boxes[i], scores[i], labels[i]))
            }
        }
        candidates.sortByDescending { it.second }

        val selected = mutableListOf<Triple<RectF, Float, Int>>()
        val active = BooleanArray(candidates.size) { true }

        for (i in candidates.indices) {
            if (!active[i]) continue
            selected.add(candidates[i])
            // Suppress same-class overlapping boxes
            for (j in i + 1 until candidates.size) {
                if (!active[j]) continue
                if (candidates[j].third != candidates[i].third) continue
                val iou = iou(candidates[i].first, candidates[j].first)
                if (iou >= iouThreshold) active[j] = false
            }
        }
        return selected
    }

    /** Intersection over Union between two RectFs (normalized or pixel coordinates both work). */
    fun iou(a: RectF, b: RectF): Float {
        val ax1 = a.left; val ay1 = a.top; val ax2 = a.right; val ay2 = a.bottom
        val bx1 = b.left; val by1 = b.top; val bx2 = b.right; val by2 = b.bottom

        val ix1 = max(ax1, bx1)
        val iy1 = max(ay1, by1)
        val ix2 = min(ax2, bx2)
        val iy2 = min(ay2, by2)
        val iw = max(0f, ix2 - ix1)
        val ih = max(0f, iy2 - iy1)
        val inter = iw * ih

        val areaA = a.width() * a.height()
        val areaB = b.width() * b.height()
        val union = areaA + areaB - inter
        return if (union == 0f) 0f else inter / union
    }

    /**
     * Decode SSDLite outputs: given raw boxes [N,4] (cx, cy, w, h form) and class scores,
     * produce RectF objects in normalized (left, top, right, bottom) order.
     */
    fun decodeBoxes(rawBoxes: Array<FloatArray>): List<RectF> {
        return rawBoxes.map { (cx, cy, w, h) ->
            RectF(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
        }
    }

    /** How a model lays out its raw box coordinates. */
    enum class BoxOrder {
        /** left, top, right, bottom  (torchvision detection models) */
        XYXY,

        /** top(y), left(x), bottom(y), right(x)  (TF Object Detection API exports) */
        YXYX
    }

    data class SsdConfig(
        val scoreThreshold: Float,
        val iouThreshold: Float,
        val maxDetections: Int,
        /** Width/height of the model input, used when boxes come back in pixels. */
        val referenceSize: Int,
        val boxOrder: BoxOrder = BoxOrder.XYXY
    )

    /**
     * Post-process raw SSD outputs into detections ready for the JS overlay.
     *
     * Handles the two things that silently ruin detections in practice:
     *  1. **Coordinate units.** torchvision exports return boxes in INPUT PIXELS (0..320),
     *     not 0..1. We detect this by looking at the largest coordinate and rescale.
     *     (Feeding pixel coordinates straight to a normalized overlay puts everything
     *     into the bottom-right corner, or off-screen entirely.)
     *  2. **Box order.** torchvision is x1,y1,x2,y2; TF OD exports are y1,x1,y2,x2.
     *
     * @param boxes    flattened N*4 box coordinates
     * @param scores   N confidence scores
     * @param classIds N class indices (0 / negative = background, dropped)
     */
    fun postProcessSsd(
        boxes: FloatArray,
        scores: FloatArray,
        classIds: IntArray,
        labels: List<String>,
        config: SsdConfig
    ): List<DetectionResultModel> {
        val n = minOf(scores.size, classIds.size, boxes.size / 4)
        if (n <= 0) return emptyList()

        // --- unit detection: pixels (0..320) vs normalized (0..1) ------------------
        var maxCoord = 0f
        for (i in 0 until n * 4) {
            val v = boxes[i]
            if (v > maxCoord) maxCoord = v
            if (-v > maxCoord) maxCoord = -v
        }
        val scale = if (maxCoord <= 1.5f || config.referenceSize <= 0) {
            1f                                  // already normalized
        } else {
            1f / config.referenceSize.toFloat() // pixel coords -> 0..1
        }

        val rects = ArrayList<RectF>(n)
        val keptScores = ArrayList<Float>(n)
        val keptClasses = ArrayList<Int>(n)

        for (i in 0 until n) {
            val classId = classIds[i]
            if (classId <= 0) continue          // 0 = background
            val score = scores[i]
            if (score.isNaN() || score < config.scoreThreshold) continue

            val o = i * 4
            val a = boxes[o] * scale
            val b = boxes[o + 1] * scale
            val c = boxes[o + 2] * scale
            val d = boxes[o + 3] * scale

            val rect = if (config.boxOrder == BoxOrder.XYXY) {
                RectF(min(a, c), min(b, d), max(a, c), max(b, d))
            } else {
                RectF(min(b, d), min(a, c), max(b, d), max(a, c))
            }
            // Clamp into the frame so the overlay never draws outside the preview
            rect.left = rect.left.coerceIn(0f, 1f)
            rect.top = rect.top.coerceIn(0f, 1f)
            rect.right = rect.right.coerceIn(0f, 1f)
            rect.bottom = rect.bottom.coerceIn(0f, 1f)
            if (rect.width() <= 0f || rect.height() <= 0f) continue

            rects.add(rect)
            keptScores.add(score)
            keptClasses.add(classId)
        }

        if (rects.isEmpty()) return emptyList()

        val scoresArr = FloatArray(keptScores.size) { keptScores[it] }
        val classesArr = IntArray(keptClasses.size) { keptClasses[it] }

        return nonMaximumSuppression(
            boxes = rects,
            scores = scoresArr,
            labels = classesArr,
            scoreThreshold = config.scoreThreshold,
            iouThreshold = config.iouThreshold
        )
            .take(if (config.maxDetections > 0) config.maxDetections else Int.MAX_VALUE)
            .map { (box, score, classId) ->
                DetectionResultModel(
                    label = labelNameFor(classId, labels),
                    confidence = score,
                    box = box
                )
            }
    }

    /**
     * Indices that exist in COCO's 91-entry category list but are NOT part of the 80
     * trainable classes. Pretrained torchvision detection weights emit labels in the
     * 91-entry index space, so a raw `labels[classId - 1]` lookup silently mislabels
     * everything after 'fire hydrant' (e.g. class 62 is 'chair', not the 62nd of 80).
     *
     * If labels.txt has >= 91 lines it is assumed to already be in model-index space and
     * is used directly; otherwise indices are mapped back to the 80-name file.
     */
    private val COCO_91_GAP_INDICES = intArrayOf(12, 26, 29, 30, 45, 86, 87, 88, 89, 90)

    fun labelNameFor(classId: Int, labels: List<String>): String {
        if (classId <= 0) return "unknown"
        if (labels.isEmpty()) return "class $classId"

        if (labels.size >= 91) {
            return labels.getOrNull(classId) ?: "class $classId"
        }

        var contiguous = classId
        for (gap in COCO_91_GAP_INDICES) {
            if (gap < classId) contiguous -= 1
        }
        return labels.getOrNull(contiguous - 1) ?: "class $classId"
    }
}

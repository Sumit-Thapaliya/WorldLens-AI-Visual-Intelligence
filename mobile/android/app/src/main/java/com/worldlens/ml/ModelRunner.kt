package com.worldlens.ml

import android.graphics.RectF
import kotlin.math.max
import kotlin.math.min

/**
 * ModelRunner - Standalone post-processing utilities (NMS, box decoding).
 *
 * Extracted from InferenceModule so they can be unit-tested in isolation.
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
}

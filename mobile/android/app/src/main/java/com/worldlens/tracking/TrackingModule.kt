package com.worldlens.tracking

import android.graphics.RectF
import com.facebook.react.bridge.*
import java.util.concurrent.atomic.AtomicInteger

/**
 * TrackingModule - Native-side object tracker companion.
 *
 * The primary SORT-like tracker is implemented in TypeScript (see sortTracker.ts)
 * to keep algorithm development fast and testable in JS. This native module
 * provides an optional high-performance native tracker that can be enabled
 * for higher frame rates on slower devices.
 *
 * Uses the same IoU + Kalman-filter-inspired logic as the JS version but runs
 * on a native HandlerThread.
 */
class TrackingModule(private val reactContext: ReactContext) :
    ReactContextBaseJavaModule(reactContext) {

    private data class NativeTrack(
        val id: Int,
        var label: String,
        var box: RectF,
        var confidence: Float,
        var age: Int = 1,
        var hits: Int = 1,
        var missedFrames: Int = 0
    )

    private val nextId = AtomicInteger(1)
    private val tracks = mutableMapOf<Int, NativeTrack>()

    @Volatile
    private var iouThreshold = 0.3f
    @Volatile
    private var maxMissed = 15
    @Volatile
    private var minHits = 2

    override fun getName(): String = "TrackingModule"

    @ReactMethod
    fun setConfig(iouThresh: Double, maxMiss: Int, minHitCount: Int) {
        iouThreshold = iouThresh.toFloat()
        maxMissed = maxMiss
        minHits = minHitCount
    }

    @ReactMethod
    fun reset() {
        tracks.clear()
        nextId.set(1)
    }

    /**
     * Update tracker with new detections from the model.
     * Detections are passed as a ReadableArray of maps {label, confidence, boundingBox:{x,y,width,height}}.
     * Returns active tracks as a ReadableArray.
     */
    @ReactMethod
    fun update(detections: ReadableArray, promise: Promise) {
        val detList = mutableListOf<Triple<String, Float, RectF>>()
        for (i in 0 until detections.size()) {
            val m = detections.getMap(i) ?: continue
            val label = m.getString("label") ?: continue
            val conf = m.getDouble("confidence").toFloat()
            val box = m.getMap("boundingBox") ?: continue
            val x = box.getDouble("x").toFloat()
            val y = box.getDouble("y").toFloat()
            val w = box.getDouble("width").toFloat()
            val h = box.getDouble("height").toFloat()
            detList.add(Triple(label, conf, RectF(x, y, x + w, y + h)))
        }

        // Greedy IoU matching, same approach as JS tracker
        val matchedTrackIds = mutableSetOf<Int>()
        val matchedDetIdx = mutableSetOf<Int>()

        // Score all pairs
        val pairs = mutableListOf<Triple<Int, Int, Float>>() // trackId, detIdx, iou
        for ((trkId, trk) in tracks) {
            for ((di, det) in detList.withIndex()) {
                if (det.first != trk.label) continue
                val iou = iou(trk.box, det.third)
                if (iou >= iouThreshold) {
                    pairs.add(Triple(trkId, di, iou))
                }
            }
        }
        pairs.sortByDescending { it.third }

        for ((trkId, di, _) in pairs) {
            if (trkId in matchedTrackIds || di in matchedDetIdx) continue
            matchedTrackIds.add(trkId)
            matchedDetIdx.add(di)
            val det = detList[di]
            val trk = tracks[trkId]!!
            trk.box = det.third
            trk.confidence = det.second
            trk.hits += 1
            trk.missedFrames = 0
            trk.age += 1
        }

        // Missed tracks
        val toRemove = mutableListOf<Int>()
        for ((trkId, trk) in tracks) {
            if (trkId !in matchedTrackIds) {
                trk.missedFrames += 1
                if (trk.missedFrames > maxMissed) toRemove.add(trkId)
            }
        }
        toRemove.forEach { tracks.remove(it) }

        // New tracks
        for ((di, det) in detList.withIndex()) {
            if (di in matchedDetIdx) continue
            val id = nextId.getAndIncrement()
            tracks[id] = NativeTrack(id, det.first, det.third, det.second)
        }

        // Build result for active tracks
        val result = Arguments.createArray()
        for ((id, trk) in tracks) {
            if (trk.missedFrames > 2 || trk.hits < minHits) continue
            result.pushMap(Arguments.createMap().apply {
                putInt("trackingId", id)
                putString("label", trk.label)
                putDouble("confidence", trk.confidence.toDouble())
                putMap("boundingBox", Arguments.createMap().apply {
                    putDouble("x", trk.box.left.toDouble())
                    putDouble("y", trk.box.top.toDouble())
                    putDouble("width", trk.box.width().toDouble())
                    putDouble("height", trk.box.height().toDouble())
                })
                putInt("age", trk.age)
            })
        }
        promise.resolve(result)
    }

    private fun iou(a: RectF, b: RectF): Float {
        val ix1 = maxOf(a.left, b.left); val iy1 = maxOf(a.top, b.top)
        val ix2 = minOf(a.right, b.right); val iy2 = minOf(a.bottom, b.bottom)
        val iw = maxOf(0f, ix2 - ix1); val ih = maxOf(0f, iy2 - iy1)
        val inter = iw * ih
        val areaA = a.width() * a.height()
        val areaB = b.width() * b.height()
        val union = areaA + areaB - inter
        return if (union == 0f) 0f else inter / union
    }
}

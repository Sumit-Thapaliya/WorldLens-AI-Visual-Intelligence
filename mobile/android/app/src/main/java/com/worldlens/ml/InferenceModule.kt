package com.worldlens.ml

import android.graphics.Bitmap
import android.graphics.Matrix
import android.graphics.RectF
import android.util.Log
import androidx.camera.core.ImageProxy
import com.facebook.react.bridge.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.nio.FloatBuffer
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference

/**
 * Data class holding a single detection result returned by the model.
 */
data class DetectionResultModel(
    val label: String,
    val confidence: Float,
    val box: RectF // normalized (0..1) coordinates
)

/**
 * InferenceModule - Native ML inference using ONNX Runtime Mobile.
 *
 * Responsibilities:
 *  - Load the SSDLite/YOLO ONNX model from assets/models/object_detector/
 *  - Preprocess camera frames to model input (resize, normalize, NHWC -> NCHW)
 *  - Run inference on CPU/GPU/NNAPI depending on device capabilities
 *  - Post-process raw outputs into DetectedObject[]
 *  - Expose latest detections to JS via getLatestDetections()
 *
 * Design note: inference runs inside the CameraX analysis thread. Results are
 * written to an AtomicReference so JS can poll the latest frame's detections
 * at its own pace (no queue buildup, frame drops are acceptable).
 */
class InferenceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "WorldLens-Inference"
        private const val MODEL_FILE = "ssdlite_mobilenet_v3.onnx"
        private const val LABELS_FILE = "labels.txt"
        private const val INPUT_SIZE = 320
        private const val CONFIDENCE_THRESHOLD_DEFAULT = 0.45f

        @Volatile
        var instance: InferenceModule? = null
            private set
    }

    init {
        instance = this
    }

    private val isInitialized = AtomicBoolean(false)
    private val lastInferenceMs = AtomicLong(0)
    private val fpsCounter = FpsCounter()

    @Volatile
    private var confidenceThreshold = CONFIDENCE_THRESHOLD_DEFAULT

    private var labels: List<String> = emptyList()

    // ONNX Runtime objects (lazily created)
    // In a real deployment these are ai.onnxruntime.* classes; we reference them
    // by name and guard with a compat layer so the project compiles even before
    // the onnxruntime dependency is linked during first build.
    private var ortEnv: Any? = null
    private var ortSession: Any? = null

    /**
     * Latest detections, kept as PLAIN KOTLIN DATA - never as a WritableArray/WritableMap.
     *
     * Why: RN's putArray/pushArray *consume* the container they are given (ownership is
     * transferred to the native side). Once consumed, reusing that same instance throws
     * "Array already consumed" in WritableNativeMap.putArray. Since JS polls
     * getLatestDetections() every frame, storing a Writable* here crashed on the 2nd poll.
     * An AtomicReference also gives us a safe hand-off between the camera thread
     * (writer) and the JS thread (reader).
     */
    private val latestDetections = AtomicReference<List<DetectionResultModel>>(emptyList())

    override fun getName(): String = "InferenceModule"

    @ReactMethod
    fun initialize(config: ReadableMap?, promise: Promise) {
        if (isInitialized.get()) {
            promise.resolve(true)
            return
        }
        try {
            // Load labels
            labels = loadLabels()
            // In production:
            //   val env = OrtEnvironment.getEnvironment()
            //   val sessionOpts = OrtSession.SessionOptions()
            //   sessionOpts.setIntraOpNumThreads(4)
            //   sessionOpts.addNnapi()  // or .addGpuDelegate() for GPU
            //   val bytes = reactContext.assets.open("models/object_detector/$MODEL_FILE").readBytes()
            //   val session = env.createSession(bytes, sessionOpts)
            //   ortEnv = env; ortSession = session
            Log.i(TAG, "Initialization placeholder — model would load here. Labels loaded: ${labels.size}")
            isInitialized.set(true)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize inference module", e)
            promise.reject("INIT_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun initialize(promise: Promise) = initialize(null, promise)

    /**
     * Called from CameraModule.analyze() for each camera frame.
     * In production this converts the ImageProxy to a Bitmap, preprocesses it,
     * runs ONNX inference, applies NMS, and writes results to latestDetections.
     */
    fun analyzeFrame(imageProxy: ImageProxy) {
        if (!isInitialized.get()) return
        val start = System.nanoTime()
        try {
            // 1. Convert ImageProxy (YUV) -> Bitmap -> model input tensor
            // val bitmap = imageProxy.toBitmap()  // CameraX ImageProxy.toBitmap()
            // val input = preprocess(bitmap, imageProxy.imageInfo.rotationDegrees)

            // 2. Run inference (placeholder returning empty set)
            val detections = runInference(/* input */)

            // 3. Publish the plain-data snapshot. The Writable* graph JS needs is built
            //    fresh inside getLatestDetections() on every call, so nothing here is
            //    ever handed to JS twice.
            latestDetections.set(detections)
        } catch (e: Exception) {
            Log.w(TAG, "Frame analysis error", e)
        } finally {
            lastInferenceMs.set((System.nanoTime() - start) / 1_000_000)
            fpsCounter.tick()
        }
    }

    /**
     * JS calls this to receive the latest detections (polling model).
     * For real apps consider pushing via DeviceEventManagerModule.
     */
    @ReactMethod
    fun getLatestDetections(frameData: ReadableMap, promise: Promise) {
        val snapshot = latestDetections.get()

        // Build a BRAND-NEW writable graph for every call. Each array/map below is handed
        // to the bridge exactly once, which is the only safe way to use Writable* types.
        val objects = Arguments.createArray()
        for ((index, d) in snapshot.withIndex()) {
            objects.pushMap(
                Arguments.createMap().apply {
                    // `id` is required by the DetectedObject TS type
                    putString("id", "det-$index")
                    putString("label", d.label)
                    putDouble("confidence", d.confidence.toDouble())
                    putMap("boundingBox", Arguments.createMap().apply {
                        putDouble("x", d.box.left.toDouble())
                        putDouble("y", d.box.top.toDouble())
                        putDouble("width", d.box.width().toDouble())
                        putDouble("height", d.box.height().toDouble())
                    })
                }
            )
        }

        val result = Arguments.createMap().apply {
            putArray("objects", objects) // consumed here, and this instance is used once
            putDouble("inferenceTimeMs", lastInferenceMs.get().toDouble())
            putDouble("fps", fpsCounter.currentFps())
        }
        promise.resolve(result)
    }

    @ReactMethod
    fun updateConfig(config: ReadableMap) {
        if (config.hasKey("confidenceThreshold")) {
            confidenceThreshold = config.getDouble("confidenceThreshold").toFloat()
        }
    }

    @ReactMethod
    fun getStats(promise: Promise) {
        promise.resolve(Arguments.createMap().apply {
            putDouble("fps", fpsCounter.currentFps())
            putDouble("inferenceTimeMs", lastInferenceMs.get().toDouble())
            putString("modelName", "ssdlite_mobilenet_v3")
        })
    }

    @ReactMethod
    fun release(promise: Promise) {
        // Close session/env if real ONNX objects exist
        isInitialized.set(false)
        latestDetections.set(emptyList())
        instance = null
        promise.resolve(true)
    }

    /**
     * Run model inference + NMS postprocessing.
     * Returns list of detections with normalized coordinates.
     */
    private fun runInference(/* input: FloatBuffer */): List<DetectionResultModel> {
        // Placeholder: in production, call ortSession.run() and post-process outputs.
        // Returning empty here — the JS mock detector will simulate detections when
        // the native module is a stub (development mode). When ONNX Runtime is
        // properly linked, replace this body with the real inference + NMS logic.
        return emptyList()
    }

    /**
     * Convert and normalize a Bitmap to a FloatBuffer suitable for the model.
     * SSDLite expects NCHW float tensor normalized to [0,1] or ImageNet mean/std.
     */
    @Suppress("unused")
    private fun preprocess(bitmap: Bitmap, rotation: Int): FloatBuffer {
        val rotated = if (rotation != 0) {
            val matrix = Matrix().apply { postRotate(rotation.toFloat()) }
            Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        } else bitmap

        val resized = Bitmap.createScaledBitmap(rotated, INPUT_SIZE, INPUT_SIZE, true)
        val buffer = FloatBuffer.allocate(1 * 3 * INPUT_SIZE * INPUT_SIZE)
        val pixels = IntArray(INPUT_SIZE * INPUT_SIZE)
        resized.getPixels(pixels, 0, INPUT_SIZE, 0, 0, INPUT_SIZE, INPUT_SIZE)

        // HWC -> CHW, normalize to 0..1
        val channelSize = INPUT_SIZE * INPUT_SIZE
        for (i in pixels.indices) {
            val p = pixels[i]
            val r = ((p shr 16) and 0xFF) / 255.0f
            val g = ((p shr 8) and 0xFF) / 255.0f
            val b = (p and 0xFF) / 255.0f
            buffer.put(i, r)
            buffer.put(channelSize + i, g)
            buffer.put(2 * channelSize + i, b)
        }
        buffer.rewind()

        if (resized !== rotated) resized.recycle()
        if (rotated !== bitmap) rotated.recycle()
        return buffer
    }

    private fun loadLabels(): List<String> {
        return try {
            reactContext.assets.open("models/object_detector/$LABELS_FILE")
                .bufferedReader().useLines { it.toList() }
        } catch (e: Exception) {
            Log.w(TAG, "Labels file not found, using empty list", e)
            emptyList()
        }
    }
}

/** Simple FPS tracker over the last second. */
private class FpsCounter {
    private val timestamps = ArrayDeque<Long>()
    @Synchronized
    fun tick() {
        val now = System.currentTimeMillis()
        timestamps.addLast(now)
        while (timestamps.first() < now - 1000) timestamps.removeFirst()
    }
    @Synchronized
    fun currentFps(): Double = timestamps.size.toDouble()
}

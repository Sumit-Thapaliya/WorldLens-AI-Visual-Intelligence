package com.worldlens.ml

import ai.onnxruntime.OnnxJavaType
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import ai.onnxruntime.TensorInfo
import android.graphics.Bitmap
import android.graphics.Matrix
import android.graphics.RectF
import android.util.Log
import androidx.camera.core.ImageProxy
import com.facebook.react.bridge.*
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
 *  - Load the ONNX model from assets/models/object_detector/ (several filenames are probed)
 *  - Preprocess camera frames to the model input (rotate upright, resize, normalize to 0..1)
 *  - Run inference on CPU, with NNAPI used automatically when the device supports it
 *  - Post-process raw outputs (threshold + per-class NMS) into DetectedObject[] for JS
 *  - Expose the latest detections to JS via getLatestDetections()
 *
 * Design note: inference runs inside the CameraX analysis thread. Results are written to an
 * AtomicReference as PLAIN DATA (never a WritableArray - those are consumed when handed to the
 * bridge) so JS can poll the latest frame's detections at its own pace.
 *
 * If no model file is present the module stays idle and isModelLoaded() returns false, which
 * makes the JS layer fall back to its mock detector instead of showing an empty screen.
 */
class InferenceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "WorldLens-Inference"
        private const val ASSET_DIR = "models/object_detector"
        private const val LABELS_FILE = "labels.txt"

        /** Any one of these inside assets/models/object_detector/ will be loaded. */
        private val MODEL_CANDIDATES = listOf(
            "model.quant.onnx",
            "ssdlite_int8.onnx",
            "ssdlite.onnx",
            "ssdlite_mobilenet_v3.onnx",
            "yolov5n.onnx"
        )

        private const val DEFAULT_INPUT_SIZE = 320
        private const val CONFIDENCE_THRESHOLD_DEFAULT = 0.45f
        private const val IOU_THRESHOLD_DEFAULT = 0.5f
        private const val MAX_DETECTIONS_DEFAULT = 20

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

    @Volatile
    private var confidenceThreshold = CONFIDENCE_THRESHOLD_DEFAULT

    @Volatile
    private var iouThreshold = IOU_THRESHOLD_DEFAULT

    @Volatile
    private var maxDetections = MAX_DETECTIONS_DEFAULT

    /** Actual model input resolution, read from the model's input tensor. */
    @Volatile
    private var inputSize = DEFAULT_INPUT_SIZE

    /** true = NCHW [1,3,H,W] (torchvision/ONNX default), false = NHWC [1,H,W,3]. */
    @Volatile
    private var inputLayoutNchw = true

    @Volatile
    private var modelLoaded = false

    @Volatile
    private var modelFileName: String? = null

    private var inputName: String = "input"
    private var labels: List<String> = emptyList()

    private var ortEnv: OrtEnvironment? = null
    private var ortSession: OrtSession? = null

    override fun getName(): String = "InferenceModule"

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    @ReactMethod
    fun initialize(config: ReadableMap?, promise: Promise) {
        if (config != null) {
            applyConfig(config)
        }
        try {
            modelLoaded = loadSession()
            isInitialized.set(true)
            promise.resolve(modelLoaded)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize inference module", e)
            isInitialized.set(true)
            modelLoaded = false
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun initialize(promise: Promise) = initialize(null, promise)

    /**
     * Synchronous status probes. `isBlockingSynchronousMethod` lets the JS layer decide
     * between the native detector and the mock detector without an async round-trip.
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun isModelLoaded(): Boolean = modelLoaded

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getModelStatus(): String {
        val file = modelFileName
        return if (modelLoaded && file != null) "loaded:$file" else "not_loaded"
    }

    /**
     * Loads the ONNX session. Returns false (instead of throwing) when no model is present so
     * the app keeps working with the JS mock detector.
     */
    private fun loadSession(): Boolean {
        if (modelLoaded && ortSession != null) return true

        val assets = reactContext.assets

        // 1. which model file do we actually have?
        var chosen: String? = null
        for (candidate in MODEL_CANDIDATES) {
            try {
                assets.open("$ASSET_DIR/$candidate").close()
                chosen = candidate
                break
            } catch (_: Exception) {
                // not present - try the next candidate
            }
        }
        if (chosen == null) {
            Log.w(
                TAG,
                "No ONNX model found in assets/$ASSET_DIR/ (looked for $MODEL_CANDIDATES). " +
                    "Run ai/scripts/convert_model.py and drop the .onnx file there. " +
                    "Meanwhile the app uses the JS mock detector."
            )
            return false
        }

        // 2. labels
        labels = loadLabels()
        Log.i(TAG, "Labels loaded: ${labels.size}")

        // 3. session
        val modelBytes = assets.open("$ASSET_DIR/$chosen").readBytes()
        val env = OrtEnvironment.getEnvironment()
        val options = OrtSession.SessionOptions()
        try {
            options.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
        } catch (e: Exception) {
            Log.w(TAG, "Could not set optimization level: ${e.message}")
        }
        try {
            options.setIntraOpNumThreads(4)
        } catch (e: Exception) {
            Log.w(TAG, "Could not set thread count: ${e.message}")
        }
        // NNAPI is a big win on supported devices but is not available everywhere.
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            try {
                options.addNnapi()
                Log.i(TAG, "NNAPI execution provider enabled")
            } catch (e: Exception) {
                Log.i(TAG, "NNAPI unavailable, using CPU: ${e.message}")
            }
        }

        val session = env.createSession(modelBytes, options)
        ortEnv = env
        ortSession = session

        // 4. read the expected input shape so preprocessing matches the model exactly
        try {
            val entry = session.inputInfo.entries.firstOrNull()
            if (entry != null) {
                inputName = entry.key
                val shape = (entry.value.info as? TensorInfo)?.shape
                if (shape != null && shape.size == 4) {
                    when {
                        shape[1] == 3L -> {
                            inputLayoutNchw = true
                            if (shape[2] > 0) inputSize = shape[2].toInt()
                        }
                        shape[3] == 3L -> {
                            inputLayoutNchw = false
                            if (shape[1] > 0) inputSize = shape[1].toInt()
                        }
                    }
                }
                Log.i(
                    TAG,
                    "Input '$inputName' shape=${shape?.toList()} -> using ${inputSize}x$inputSize " +
                        (if (inputLayoutNchw) "NCHW" else "NHWC")
                )
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not read input shape, assuming $inputSize NCHW: ${e.message}")
        }

        modelFileName = chosen
        modelLoaded = true
        Log.i(TAG, "Model ready: $chosen (${modelBytes.size / 1024} KB)")
        return true
    }

    @ReactMethod
    fun release(promise: Promise) {
        try {
            ortSession?.close()
        } catch (e: Exception) {
            Log.w(TAG, "Error closing session", e)
        }
        ortSession = null
        // NOTE: OrtEnvironment.getEnvironment() is a process-wide singleton - deliberately
        // not closed here, or any later session creation would fail.
        ortEnv = null
        modelLoaded = false
        isInitialized.set(false)
        latestDetections.set(emptyList())
        instance = null
        promise.resolve(true)
    }

    // -------------------------------------------------------------------------
    // Inference
    // -------------------------------------------------------------------------

    /**
     * Called from CameraModule.analyze() for each camera frame. Runs on CameraX's analysis
     * executor. Purely additive: when no model is loaded this returns immediately and the
     * JS mock detector keeps driving the UI.
     */
    fun analyzeFrame(imageProxy: ImageProxy) {
        if (!isInitialized.get() || !modelLoaded) return
        val session = ortSession ?: return

        val start = System.nanoTime()
        var bitmap: Bitmap? = null
        try {
            // CameraX default output is YUV_420_888, which toBitmap() converts for us.
            bitmap = imageProxy.toBitmap()
            val detections = runInference(session, bitmap, imageProxy.imageInfo.rotationDegrees)
            latestDetections.set(detections)
        } catch (e: Exception) {
            Log.w(TAG, "Frame analysis error", e)
        } finally {
            try {
                bitmap?.recycle()
            } catch (_: Exception) {
                // ignore - bitmap already recycled
            }
            lastInferenceMs.set((System.nanoTime() - start) / 1_000_000)
            fpsCounter.tick()
        }
    }

    private fun runInference(
        session: OrtSession,
        bitmap: Bitmap,
        rotationDegrees: Int
    ): List<DetectionResultModel> {
        val env = ortEnv ?: return emptyList()

        val pixels = preprocess(bitmap, rotationDegrees, inputSize, inputLayoutNchw)
        val shape = if (inputLayoutNchw) {
            longArrayOf(1, 3, inputSize.toLong(), inputSize.toLong())
        } else {
            longArrayOf(1, inputSize.toLong(), inputSize.toLong(), 3)
        }

        val tensor = OnnxTensor.createTensor(env, pixels, shape)
        tensor.use { input ->
            session.run(mapOf(inputName to input)).use { result ->
                val outputs = resolveOutputs(result)
                val boxes = outputs.boxes ?: return emptyList()
                val scores = outputs.scores ?: return emptyList()
                val classIds = outputs.classIds ?: return emptyList()

                return ModelRunner.postProcessSsd(
                    boxes = boxes,
                    scores = scores,
                    classIds = classIds,
                    labels = labels,
                    config = ModelRunner.SsdConfig(
                        scoreThreshold = confidenceThreshold,
                        iouThreshold = iouThreshold,
                        maxDetections = maxDetections,
                        referenceSize = inputSize,
                        boxOrder = ModelRunner.BoxOrder.XYXY
                    )
                )
            }
        }
    }

    private class RawOutputs(
        val boxes: FloatArray?,
        val scores: FloatArray?,
        val classIds: IntArray?
    )

    /**
     * Maps the session outputs onto boxes / scores / classes by name, falling back to the
     * positional order used by ai/scripts/convert_model.py (boxes, scores, labels).
     */
    private fun resolveOutputs(result: OrtSession.Result): RawOutputs {
        var boxes: FloatArray? = null
        var scores: FloatArray? = null
        var classIds: IntArray? = null

        val named = ArrayList<Pair<String, OnnxTensor>>()
        for ((name, value) in result) {
            if (value is OnnxTensor) named.add(name.lowercase() to value)
        }

        for ((name, tensor) in named) {
            when {
                boxes == null && name.contains("box") -> boxes = readFloats(tensor)
                scores == null && (name.contains("score") || name.contains("conf")) ->
                    scores = readFloats(tensor)
                classIds == null && (name.contains("label") || name.contains("class")) ->
                    classIds = readClassIds(tensor)
            }
        }

        // positional fallback for models with unhelpful output names
        if (named.size >= 3) {
            if (boxes == null) boxes = readFloats(named[0].second)
            if (scores == null) scores = readFloats(named[1].second)
            if (classIds == null) classIds = readClassIds(named[2].second)
        }

        return RawOutputs(boxes, scores, classIds)
    }

    private fun readFloats(tensor: OnnxTensor): FloatArray? {
        return try {
            if (tensor.info.type != OnnxJavaType.FLOAT) return null
            val buffer = tensor.floatBuffer
            val out = FloatArray(buffer.remaining())
            buffer.get(out)
            out
        } catch (e: Exception) {
            Log.w(TAG, "Could not read float output: ${e.message}")
            null
        }
    }

    private fun readClassIds(tensor: OnnxTensor): IntArray? {
        return try {
            when (tensor.info.type) {
                OnnxJavaType.INT64 -> {
                    val buffer = tensor.longBuffer
                    val out = IntArray(buffer.remaining())
                    for (i in out.indices) out[i] = buffer.get().toInt()
                    out
                }
                OnnxJavaType.INT32 -> {
                    val buffer = tensor.intBuffer
                    val out = IntArray(buffer.remaining())
                    buffer.get(out)
                    out
                }
                OnnxJavaType.FLOAT -> {
                    val buffer = tensor.floatBuffer
                    val out = IntArray(buffer.remaining())
                    for (i in out.indices) out[i] = buffer.get().toInt()
                    out
                }
                else -> null
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not read class output: ${e.message}")
            null
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
        applyConfig(config)
    }

    private fun applyConfig(config: ReadableMap) {
        if (config.hasKey("confidenceThreshold")) {
            confidenceThreshold = config.getDouble("confidenceThreshold").toFloat()
        }
        if (config.hasKey("maxDetections")) {
            maxDetections = config.getDouble("maxDetections").toInt()
        }
        if (config.hasKey("iouThreshold")) {
            iouThreshold = config.getDouble("iouThreshold").toFloat()
        }
    }

    @ReactMethod
    fun getStats(promise: Promise) {
        promise.resolve(Arguments.createMap().apply {
            putDouble("fps", fpsCounter.currentFps())
            putDouble("inferenceTimeMs", lastInferenceMs.get().toDouble())
            putString("modelName", modelFileName ?: "none")
            putBoolean("modelLoaded", modelLoaded)
            putInt("inputSize", inputSize)
        })
    }

    // -------------------------------------------------------------------------
    // Preprocessing / labels
    // -------------------------------------------------------------------------

    /**
     * Rotate upright, resize and normalise a frame into the model's input tensor layout.
     *
     * Values are scaled to 0..1: the torchvision detection graph exported by
     * ai/scripts/convert_model.py includes its own ImageNet mean/std normalisation
     * (GeneralizedRCNNTransform.normalize runs inside forward()), so the input must NOT be
     * mean/std normalised here, or detections degrade badly.
     *
     * The frame is stretched to a square rather than centre-cropped on purpose: keeping the
     * full field of view means the returned boxes stay valid for the whole preview, which is
     * what the JS overlay assumes.
     */
    private fun preprocess(
        bitmap: Bitmap,
        rotationDegrees: Int,
        size: Int,
        nchw: Boolean
    ): FloatBuffer {
        val rotated = if (rotationDegrees != 0) {
            val matrix = Matrix().apply { postRotate(rotationDegrees.toFloat()) }
            Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        } else {
            bitmap
        }

        val resized = Bitmap.createScaledBitmap(rotated, size, size, true)
        val pixels = IntArray(size * size)
        resized.getPixels(pixels, 0, size, 0, 0, size, size)

        val channelSize = size * size
        val buffer = FloatBuffer.allocate(3 * channelSize)

        for (i in pixels.indices) {
            val p = pixels[i]
            val r = ((p shr 16) and 0xFF) / 255.0f
            val g = ((p shr 8) and 0xFF) / 255.0f
            val b = (p and 0xFF) / 255.0f
            if (nchw) {
                // planar RRR...GGG...BBB...
                buffer.put(i, r)
                buffer.put(channelSize + i, g)
                buffer.put(2 * channelSize + i, b)
            } else {
                // interleaved RGBRGB...
                buffer.put(i * 3, r)
                buffer.put(i * 3 + 1, g)
                buffer.put(i * 3 + 2, b)
            }
        }
        buffer.rewind()

        if (resized !== rotated) resized.recycle()
        if (rotated !== bitmap) rotated.recycle()
        return buffer
    }

    private fun loadLabels(): List<String> {
        return try {
            reactContext.assets.open("$ASSET_DIR/$LABELS_FILE")
                .bufferedReader()
                .useLines { lines ->
                    lines.map { it.trim() }
                        .filter { it.isNotEmpty() }
                        .toList()
                }
        } catch (e: Exception) {
            Log.w(TAG, "Labels file not found, using generated class names", e)
            emptyList()
        }
    }
}

/** Simple FPS tracker over the last second. */
private class FpsCounter {
    private val timestamps = ArrayDeque<Long>()

    /**
     * Drop samples older than one second.
     * NOTE: `timestamps.first()` throws NoSuchElementException on an empty deque, and
     * because tick() is called from analyzeFrame()'s `finally` block that exception would
     * escape into CameraX's analyzer thread. The isNotEmpty() guard is mandatory.
     */
    private fun prune(now: Long) {
        while (timestamps.isNotEmpty() && timestamps.first() < now - 1000) {
            timestamps.removeFirst()
        }
    }

    @Synchronized
    fun tick() {
        val now = System.currentTimeMillis()
        timestamps.addLast(now)
        prune(now)
    }

    @Synchronized
    fun currentFps(): Double {
        // Prune on read too, otherwise the count stays stale once frames stop arriving.
        prune(System.currentTimeMillis())
        return timestamps.size.toDouble()
    }
}

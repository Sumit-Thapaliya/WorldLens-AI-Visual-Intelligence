package com.worldlens.camera

import android.annotation.SuppressLint
import android.content.Context
import android.util.Size
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.worldlens.ml.InferenceModule
import java.util.concurrent.Executors

/**
 * CameraModule - Kotlin native camera module using CameraX.
 *
 * Responsible for:
 *  - Binding camera preview to a Surface/PreviewView
 *  - Configuring analysis frame rate and resolution
 *  - Forwarding frames to the InferenceModule for on-device detection
 *
 * Frame analysis runs on a background executor so inference doesn't block the UI.
 */
class CameraModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val analysisExecutor = Executors.newSingleThreadExecutor { r ->
        Thread(r, "WorldLens-CameraAnalysis").apply { isDaemon = true }
    }

    private var cameraProvider: ProcessCameraProvider? = null
    private var preview: Preview? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var camera: Camera? = null
    private var lensFacing = CameraSelector.LENS_FACING_BACK

    @Volatile
    private var isRunning = false

    override fun getName(): String = "CameraModule"

    /**
     * Start the camera with the given lifecycle owner (current Activity).
     * Frames are sent to the linked InferenceModule.
     */
    @ReactMethod
    fun startCamera(width: Int = 640, height: Int = 480, targetFps: Int = 25) {
        val activity = currentActivity ?: return
        if (isRunning) return

        val cameraProviderFuture = ProcessCameraProvider.getInstance(reactContext)
        cameraProviderFuture.addListener({
            try {
                val provider = cameraProviderFuture.get()
                cameraProvider = provider

                // Preview use case
                preview = Preview.Builder()
                    .setTargetResolution(Size(width, height))
                    .build()

                // ImageAnalysis use case (feeds ML model)
                imageAnalysis = ImageAnalysis.Builder()
                    .setTargetResolution(Size(width, height))
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()
                    .also {
                        it.setAnalyzer(analysisExecutor) { imageProxy ->
                            try {
                                // Forward frame to the ML inference module
                                InferenceModule.instance?.analyzeFrame(imageProxy)
                            } finally {
                                imageProxy.close()
                            }
                        }
                    }

                val cameraSelector = CameraSelector.Builder()
                    .requireLensFacing(lensFacing)
                    .build()

                provider.unbindAll()
                camera = provider.bindToLifecycle(
                    activity as LifecycleOwner,
                    cameraSelector,
                    preview,
                    imageAnalysis
                )
                isRunning = true
                emitEvent("camera_ready", null)
            } catch (e: Exception) {
                emitEvent("camera_error", e.message)
            }
        }, ContextCompat.getMainExecutor(reactContext))
    }

    @ReactMethod
    fun stopCamera() {
        cameraProvider?.unbindAll()
        camera = null
        isRunning = false
    }

    @ReactMethod
    fun switchCamera() {
        lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK) {
            CameraSelector.LENS_FACING_FRONT
        } else {
            CameraSelector.LENS_FACING_BACK
        }
        stopCamera()
        startCamera()
    }

    @ReactMethod
    fun isCameraRunning(promise: Promise) {
        promise.resolve(isRunning)
    }

    private fun emitEvent(eventName: String, message: String?) {
        val params = Arguments.createMap().apply {
            putString("message", message)
        }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    fun release() {
        stopCamera()
        analysisExecutor.shutdown()
    }
}

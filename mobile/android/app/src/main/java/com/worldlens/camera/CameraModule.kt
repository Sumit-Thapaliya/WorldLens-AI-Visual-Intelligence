package com.worldlens.camera

import android.content.Context
import android.util.Log
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.worldlens.ml.InferenceModule
import java.util.concurrent.Executors

/**
 * CameraModule - Kotlin native camera module using CameraX.
 */
class CameraModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "WorldLens-CameraModule"
    }

    private val analysisExecutor = Executors.newSingleThreadExecutor { r ->
        Thread(r, "WorldLens-CameraAnalysis").apply { isDaemon = true }
    }

    private var cameraProvider: ProcessCameraProvider? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var camera: Camera? = null
    private var lensFacing = CameraSelector.LENS_FACING_BACK

    @Volatile
    private var isRunning = false

    override fun getName(): String = "CameraModule"

    @ReactMethod
    fun startCamera() {
        startCameraInternal(640, 480)
    }

    @ReactMethod
    fun startCameraWithConfig(width: Int, height: Int, targetFps: Int) {
        startCameraInternal(width, height)
    }

    private fun startCameraInternal(width: Int, height: Int) {
        val activity = currentActivity ?: return
        if (isRunning) return

        val cameraProviderFuture = ProcessCameraProvider.getInstance(reactContext)
        cameraProviderFuture.addListener({
            try {
                val provider = cameraProviderFuture.get()
                cameraProvider = provider

                imageAnalysis = ImageAnalysis.Builder()
                    .setTargetAspectRatio(androidx.camera.core.AspectRatio.RATIO_4_3)
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                    .build()
                    .also {
                        it.setAnalyzer(analysisExecutor) { imageProxy ->
                            try {
                                InferenceModule.instance?.analyzeFrame(imageProxy)
                            } catch (e: Exception) {
                                Log.w(TAG, "Analysis error", e)
                            } finally {
                                imageProxy.close()
                            }
                        }
                    }

                val targetSelector = CameraSelector.Builder().requireLensFacing(lensFacing).build()
                val finalSelector = when {
                    provider.hasCamera(targetSelector) -> targetSelector
                    provider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA) -> CameraSelector.DEFAULT_BACK_CAMERA
                    provider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA) -> CameraSelector.DEFAULT_FRONT_CAMERA
                    else -> null
                }

                if (finalSelector == null) {
                    emitEvent("camera_error", "No camera available on this device")
                    return@addListener
                }

                provider.unbindAll()
                camera = provider.bindToLifecycle(
                    activity as LifecycleOwner,
                    finalSelector,
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
        UiThreadUtil.runOnUiThread {
            try {
                cameraProvider?.unbindAll()
            } catch (_: Exception) {}
            camera = null
            isRunning = false
        }
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
        if (!reactContext.hasActiveReactInstance()) return
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

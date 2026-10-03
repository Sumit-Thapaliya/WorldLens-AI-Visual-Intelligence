package com.worldlens.camera

import android.annotation.SuppressLint
import android.content.Context
import android.util.AttributeSet
import android.util.Log
import android.widget.FrameLayout
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.ReactContext
import com.worldlens.ml.InferenceModule
import java.util.concurrent.Executors

/**
 * CameraPreviewView - Android native View holding CameraX PreviewView.
 * Renders real camera feed directly into React Native and routes frames
 * to InferenceModule for AI detection.
 */
class CameraPreviewView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    companion object {
        private const val TAG = "WorldLens-CameraView"
    }

    private val previewView: PreviewView = PreviewView(context).apply {
        scaleType = PreviewView.ScaleType.FILL_CENTER
        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    }

    private val analysisExecutor = Executors.newSingleThreadExecutor { r ->
        Thread(r, "WorldLens-CameraAnalysis").apply { isDaemon = true }
    }

    private var cameraProvider: ProcessCameraProvider? = null
    private var lensFacing = CameraSelector.LENS_FACING_BACK
    private var isBound = false

    init {
        addView(
            previewView,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        )
    }

    fun setFacing(facingStr: String?) {
        val newFacing = if (facingStr.equals("front", ignoreCase = true)) {
            CameraSelector.LENS_FACING_FRONT
        } else {
            CameraSelector.LENS_FACING_BACK
        }
        if (lensFacing != newFacing) {
            lensFacing = newFacing
            if (isAttachedToWindow) {
                bindCamera()
            }
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        bindCamera()
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        unbindCamera()
    }

    @SuppressLint("UnsafeOptInUsageError")
    private fun bindCamera() {
        val reactCtx = context as? ReactContext ?: return
        val activity = reactCtx.currentActivity as? LifecycleOwner ?: return

        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            try {
                val provider = cameraProviderFuture.get()
                cameraProvider = provider

                // Configure Preview use case connected to PreviewView's Surface
                val preview = Preview.Builder().build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }

                // Configure ImageAnalysis use case to feed frames to InferenceModule
                val imageAnalysis = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                    .build()
                    .also {
                        it.setAnalyzer(analysisExecutor) { imageProxy ->
                            try {
                                InferenceModule.instance?.analyzeFrame(imageProxy)
                            } catch (e: Exception) {
                                Log.w(TAG, "Frame analysis error: ${e.message}")
                            } finally {
                                imageProxy.close()
                            }
                        }
                    }

                // Resilient Camera Selector: Fall back if specified facing is missing (e.g. on Emulators)
                val targetSelector = CameraSelector.Builder().requireLensFacing(lensFacing).build()
                val finalSelector = when {
                    provider.hasCamera(targetSelector) -> targetSelector
                    provider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA) -> CameraSelector.DEFAULT_BACK_CAMERA
                    provider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA) -> CameraSelector.DEFAULT_FRONT_CAMERA
                    else -> null
                }

                if (finalSelector == null) {
                    Log.e(TAG, "No camera available on this device/emulator")
                    return@addListener
                }

                provider.unbindAll()
                provider.bindToLifecycle(
                    activity,
                    finalSelector,
                    preview,
                    imageAnalysis
                )
                isBound = true
                Log.i(TAG, "Camera bound successfully to preview and analysis")
            } catch (e: Exception) {
                Log.e(TAG, "Error binding camera: ${e.message}", e)
            }
        }, ContextCompat.getMainExecutor(context))
    }

    private fun unbindCamera() {
        try {
            cameraProvider?.unbindAll()
            isBound = false
        } catch (e: Exception) {
            Log.w(TAG, "Error unbinding camera: ${e.message}")
        }
    }
}

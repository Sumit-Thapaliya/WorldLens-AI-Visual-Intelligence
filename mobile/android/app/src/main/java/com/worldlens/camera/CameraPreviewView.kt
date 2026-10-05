package com.worldlens.camera

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.SurfaceTexture
import android.util.AttributeSet
import android.util.Log
import android.view.Surface
import android.view.TextureView
import android.widget.FrameLayout
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.core.SurfaceRequest
import androidx.camera.core.UseCase
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.worldlens.ml.InferenceModule
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/**
 * CameraPreviewView - the live camera surface inside the React Native hierarchy.
 *
 * Renders the CameraX preview and feeds every analysed frame to InferenceModule.
 *
 * WHY THIS NO LONGER USES CameraX's PreviewView
 * ---------------------------------------------
 * The previous build reported:
 *
 *     Camera bound: preview+analysis(RGBA) (state=RESUMED shown=true lens=1)
 *     CameraX requested a preview surface: 1440x1080
 *     Stream check: frames=0 state=RESUMED shown=true surfaceRequested=true
 *                   TextureView available=false 0x0
 *
 * Everything was right - correct lifecycle state, camera opened, surface requested - but
 * PreviewView's OWN internal TextureView measured 0x0 and never became available, so there was
 * no surface for the camera to draw into. No frames, no error, black screen.
 *
 * That TextureView is PreviewView's private child, sized by PreviewView's own layout pass, so it
 * cannot be inspected, fixed or worked around from here. This class therefore owns its surface
 * directly: a plain TextureView added with MATCH_PARENT, handed to CameraX through a custom
 * SurfaceProvider. That removes PreviewView's layout behaviour from the equation completely, and
 * gives two independent, verifiable signals:
 *
 *   - `onSurfaceTextureAvailable`  -> this view really has a surface, and it is this big
 *   - `onSurfaceTextureUpdated`    -> a frame was RENDERED into it (proof the picture is on screen)
 *
 * A TextureView is used rather than a SurfaceView because it composites in normal view order, so
 * the React overlay drawn on top of it stays visible. A SurfaceView draws in a separate layer
 * beneath the window and would punch through and hide it.
 *
 * Other fixes kept from earlier attempts: the view is its own LifecycleOwner (never relying on
 * `currentActivity`), the lifecycle state is DERIVED from isAttachedToWindow && isShown and
 * re-evaluated before every bind, only one instance may hold the camera, and each instance
 * unbinds only its own use cases rather than calling unbindAll().
 */
class CameraPreviewView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr), LifecycleOwner {

    companion object {
        private const val TAG = "WorldLens-CameraView"

        /** Only one instance may hold the camera; CameraX allows a single active Preview. */
        @Volatile
        private var activeInstance: CameraPreviewView? = null
    }

    /**
     * Own lifecycle, so binding never depends on `reactContext.currentActivity`.
     *
     * A FUNCTION rather than `override val lifecycle`: LifecycleOwner is a Java interface in
     * lifecycle-common 2.5.1 (declares `getLifecycle()`) and a Kotlin one in 2.6.2 (declares
     * `val lifecycle`). No single form satisfies both, and CameraX 1.3.1 pulls in 2.5.1, which is
     * what this module compiles against. If the dependency is upgraded to 2.6.x or newer, replace
     * this with:  override val lifecycle: Lifecycle get() = lifecycleRegistry
     */
    private val lifecycleRegistry = LifecycleRegistry(this)
    override fun getLifecycle(): Lifecycle = lifecycleRegistry

    // ── the surface we own outright ──────────────────────────────────────────
    private val textureView = TextureView(context)

    private var surfaceAvailable = false

    /** True while a bind chain is running, so two binds can never be started at once. */
    private var bindInFlight = false

    /** True when CameraX asked for a surface and there was none to give (yet). */
    private var declinedSurface = false

    /** True while CameraX holds a Surface built on this view's SurfaceTexture. */
    private var surfaceProvided = false

    /** True once we have released the SurfaceTexture ourselves. */
    private var textureReleased = false

    /**
     * Set when the view is going away while CameraX still holds the surface: the SurfaceTexture
     * cannot be released until CameraX reports it is finished, so the release is deferred to the
     * provideSurface callback.
     */
    private var releaseTextureWhenDone = false

    /**
     * Every use case this instance has ever bound.
     *
     * This used to store only the most recent pair, which was a crash: a second bind overwrote the
     * reference to the first one, so unbind() on teardown released only the second pair and left
     * the first Preview use case bound to a surface that was about to be destroyed.
     */
    private val allBoundUseCases = mutableListOf<UseCase>()

    private val surfaceListener = object : TextureView.SurfaceTextureListener {
        override fun onSurfaceTextureAvailable(st: SurfaceTexture, w: Int, h: Int) {
            Log.i(TAG, "TextureView surface AVAILABLE ${w}x$h hwAccel=$isHardwareAccelerated")
            surfaceAvailable = true
            textureReleased = false

            // Only ONE bind may run at a time. Calling bindCamera() here while the bind started by
            // onAttachedToWindow was still in flight is what produced two bound use cases, two
            // provideSurface calls and the stray "surface already provided" result in the log.
            if (bindInFlight) {
                Log.i(TAG, "A bind is already in flight - it will use this surface")
                return
            }
            if (isBound && !declinedSurface) {
                Log.i(TAG, "Already streaming - nothing to do")
                return
            }
            declinedSurface = false
            unbindMine()
            bindCamera()
        }

        override fun onSurfaceTextureSizeChanged(st: SurfaceTexture, w: Int, h: Int) {
            Log.i(TAG, "TextureView size changed ${w}x$h")
        }

        /**
         * THE CRASH LIVED HERE.
         *
         * Returning true tells the framework "no one will touch this SurfaceTexture again, release
         * it now". That is wrong for us: CameraX holds a Surface built on this SurfaceTexture, and
         * it keeps using it after the view detaches. The previous build logged exactly that -
         * "surface DESTROYED", then 225ms later "Preview surface result: accepted" - meaning native
         * camera code wrote into a released texture. That is a use-after-free and it kills the
         * process with no Java exception to catch.
         *
         * The Android docs are explicit: returning false means the client must call
         * SurfaceTexture.release() itself. So when CameraX still holds the surface we return false
         * and release it in the provideSurface callback, once CameraX says it is finished.
         */
        override fun onSurfaceTextureDestroyed(st: SurfaceTexture): Boolean {
            surfaceAvailable = false
            if (surfaceProvided && !textureReleased) {
                releaseTextureWhenDone = true
                Log.i(
                    TAG,
                    "Surface DESTROYED while CameraX still holds it - deferring the release " +
                        "until CameraX is done (returning false)"
                )
                return false
            }
            Log.i(TAG, "Surface DESTROYED with no CameraX surface outstanding - framework releases it")
            return true
        }

        override fun onSurfaceTextureUpdated(st: SurfaceTexture) {
            val n = previewFrames.incrementAndGet()
            if (n == 1 || n % 60 == 0) {
                Log.i(TAG, "Preview frame #$n rendered on screen")
            }
        }
    }

    private val analysisExecutor = Executors.newSingleThreadExecutor { r ->
        Thread(r, "WorldLens-CameraAnalysis").apply { isDaemon = true }
    }

    private var cameraProvider: ProcessCameraProvider? = null
    private var lensFacing = CameraSelector.LENS_FACING_BACK
    private var isBound = false

    /** Only this instance's use cases are ever unbound - never the whole provider. */
    private var boundPreview: Preview? = null
    private var boundAnalysis: ImageAnalysis? = null

    private val analysisFrames = AtomicInteger(0)
    private val previewFrames = AtomicInteger(0)
    private var bindRetries = 0

    init {
        textureView.surfaceTextureListener = surfaceListener
        addView(textureView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
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
                unbindMine()
                bindCamera()
            }
        }
    }

    // ─────────────────────────── lifecycle ───────────────────────────

    /** What the camera needs: drawable means attached, and shown up the whole hierarchy. */
    private fun desiredState(): Lifecycle.State =
        if (isAttachedToWindow && isShown) Lifecycle.State.RESUMED else Lifecycle.State.CREATED

    private fun refreshState() = moveToState(desiredState())

    private fun moveToState(target: Lifecycle.State) {
        val current = lifecycleRegistry.currentState
        if (current == target) return
        Log.i(TAG, "Lifecycle $current -> $target (attached=$isAttachedToWindow shown=$isShown)")
        try {
            lifecycleRegistry.currentState = target
        } catch (e: Exception) {
            Log.w(TAG, "Lifecycle move to $target failed: ${e.message}")
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        Log.i(TAG, "Attached to window (shown=$isShown hwAccel=$isHardwareAccelerated)")
        refreshState()
        bindCamera()
    }

    override fun onDetachedFromWindow() {
        Log.i(TAG, "Detached from window")
        moveToState(Lifecycle.State.CREATED)
        unbindMine()
        if (activeInstance === this) activeInstance = null
        super.onDetachedFromWindow()
    }

    override fun onVisibilityChanged(changedView: android.view.View, visibility: Int) {
        super.onVisibilityChanged(changedView, visibility)
        if (changedView === this) refreshState()
    }

    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(visibility)
        refreshState()
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        if (!changed) return
        val w = right - left
        val h = bottom - top
        Log.i(
            TAG,
            "Laid out: frame=${w}x$h textureView=${textureView.width}x${textureView.height} " +
                "available=$surfaceAvailable"
        )
        if (w == 0 || h == 0 || textureView.width == 0 || textureView.height == 0) {
            Log.e(TAG, "ZERO size - the camera cannot draw. Check the <CameraPreview> style.")
        }
    }

    // ─────────────────────────── binding ───────────────────────────

    @SuppressLint("UnsafeOptInUsageError")
    private fun bindCamera() {
        if (isBound || bindInFlight) {
            Log.i(TAG, "bindCamera skipped (bound=$isBound inFlight=$bindInFlight)")
            return
        }
        bindInFlight = true

        // The state must be right BEFORE binding: a camera bound while the owner is not STARTED
        // never opens, and silently delivers nothing.
        refreshState()

        val previous = activeInstance
        if (previous != null && previous !== this) {
            Log.i(TAG, "Another CameraPreviewView is active - releasing its camera first")
            previous.unbindMine()
        }
        activeInstance = this

        val providerFuture = ProcessCameraProvider.getInstance(context)
        providerFuture.addListener({
            try {
            val provider = try {
                providerFuture.get()
            } catch (e: Exception) {
                fail("Camera provider unavailable: ${e.message}")
                return@addListener
            }
            cameraProvider = provider

            val selector = pickSelector(provider)
            if (selector == null) {
                fail("No camera available on this device")
                return@addListener
            }

            // Release only OUR use cases - unbindAll() would tear down another instance's too.
            unbindMine()

            val attempts = listOf(
                Attempt("preview+analysis(RGBA)", ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888, true),
                Attempt("preview+analysis(YUV)", ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888, true),
                Attempt("preview only", null, false)
            )

            for (attempt in attempts) {
                try {
                    val preview = Preview.Builder().build()

                    // Hand CameraX OUR surface, explicitly. If the TextureView has no surface
                    // yet, decline this request instead of pretending - the listener above
                    // rebinds as soon as there is something to draw into.
                    preview.setSurfaceProvider { request ->
                        val st = textureView.surfaceTexture
                        if (!surfaceAvailable || st == null) {
                            Log.w(
                                TAG,
                                "Surface requested ${request.resolution} but the TextureView has " +
                                    "no surface yet - declining; will rebind when it is ready"
                            )
                            request.willNotProvideSurface()
                            return@setSurfaceProvider
                        }
                        Log.i(TAG, "Providing surface ${request.resolution} to CameraX")
                        st.setDefaultBufferSize(request.resolution.width, request.resolution.height)
                        val surface = Surface(st)
                        surfaceProvided = true
                        request.provideSurface(
                            surface,
                            ContextCompat.getMainExecutor(context)
                        ) { result ->
                            // Our own Surface wrapper is always ours to release.
                            try {
                                surface.release()
                            } catch (e: Exception) {
                                Log.w(TAG, "Could not release Surface: ${e.message}")
                            }
                            surfaceProvided = false

                            // Release the SurfaceTexture only when it is genuinely safe: either
                            // CameraX used it to the end, or the view was destroyed while CameraX
                            // still held it (releaseTextureWhenDone). Exactly one release happens.
                            val shouldReleaseTexture =
                                result.resultCode ==
                                    SurfaceRequest.Result.RESULT_SURFACE_USED_SUCCESSFULLY ||
                                    releaseTextureWhenDone
                            releaseTextureWhenDone = false
                            if (shouldReleaseTexture && !textureReleased) {
                                try {
                                    st.release()
                                    textureReleased = true
                                    Log.i(TAG, "Released the SurfaceTexture - CameraX is finished with it")
                                } catch (e: Exception) {
                                    Log.w(TAG, "Could not release SurfaceTexture: ${e.message}")
                                }
                            }

                            val ok = result.resultCode ==
                                SurfaceRequest.Result.RESULT_SURFACE_USED_SUCCESSFULLY
                            Log.i(TAG, "Preview surface result: ${result.resultCode} (accepted=$ok)")
                        }
                    }

                    val analysis = if (attempt.withAnalysis) {
                        ImageAnalysis.Builder()
                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            .setOutputImageFormat(attempt.format!!)
                            .build()
                            .also {
                                it.setAnalyzer(analysisExecutor) { imageProxy ->
                                    try {
                                        val n = analysisFrames.incrementAndGet()
                                        if (n == 1 || n % 30 == 0) {
                                            Log.i(
                                                TAG,
                                                "Analysis frame #$n " +
                                                    "(${imageProxy.width}x${imageProxy.height})"
                                            )
                                        }
                                        InferenceModule.instance?.analyzeFrame(imageProxy)
                                    } catch (e: Exception) {
                                        Log.w(TAG, "Frame analysis error: ${e.message}")
                                    } finally {
                                        imageProxy.close()
                                    }
                                }
                            }
                    } else {
                        null
                    }

                    val useCases = listOfNotNull(preview, analysis)
                    val camera = provider.bindToLifecycle(this, selector, *useCases.toTypedArray())

                    boundPreview = preview
                    boundAnalysis = analysis
                    allBoundUseCases.add(preview)
                    if (analysis != null) allBoundUseCases.add(analysis)
                    isBound = true

                    Log.i(
                        TAG,
                        "Camera bound: ${attempt.name} (state=${lifecycleRegistry.currentState} " +
                            "lens=${camera.cameraInfo.lensFacing} surface=$surfaceAvailable)"
                    )
                    emit("camera_ready", attempt.name)

                    postDelayed({ refreshState() }, 300)
                    postDelayed({ verifyStreaming() }, 3000)
                    return@addListener
                } catch (e: Exception) {
                    Log.w(TAG, "Bind attempt failed [${attempt.name}]: ${e.message}")
                    unbindMine()
                }
            }

            fail("Camera could not start on this device (all ${attempts.size} bind attempts failed)")
            } finally {
                // Cleared on every exit path, so a failed bind can never block later ones.
                bindInFlight = false
            }
        }, ContextCompat.getMainExecutor(context))
    }

    /**
     * Reports the truth about streaming. Two independent counters: analysis frames prove the
     * camera is delivering data, preview frames prove pixels reached the screen. They can differ,
     * and knowing which is which decides the fix.
     */
    private fun verifyStreaming() {
        if (!isAttachedToWindow) return

        val a = analysisFrames.get()
        val p = previewFrames.get()
        Log.i(
            TAG,
            "Stream check: analysisFrames=$a previewFrames=$p state=${lifecycleRegistry.currentState} " +
                "shown=$isShown surfaceAvailable=$surfaceAvailable " +
                "textureView=${textureView.width}x${textureView.height} hwAccel=$isHardwareAccelerated"
        )

        if (a > 0 || p > 0) {
            if (p == 0) {
                Log.w(TAG, "Camera is streaming but nothing is being rendered to the screen")
            }
            return
        }
        if (!isBound) return

        if (bindRetries < 1) {
            bindRetries++
            Log.w(TAG, "No frames yet - rebinding once")
            unbindMine()
            refreshState()
            bindCamera()
            return
        }

        val reason = "Camera bound but delivered no frames " +
            "(surfaceAvailable=$surfaceAvailable hwAccel=$isHardwareAccelerated " +
            "textureView=${textureView.width}x${textureView.height})"
        Log.e(TAG, reason)
        emit("camera_error", reason)
    }

    /** Unbinds only this instance's use cases. Never touches anyone else's. */
    private fun unbindMine() {
        // Unbind EVERY use case this instance ever bound, not just the most recent pair. Missing
        // one leaves a Preview use case alive holding a surface that is about to be destroyed.
        if (allBoundUseCases.isNotEmpty()) {
            try {
                cameraProvider?.unbind(*allBoundUseCases.toTypedArray())
                Log.i(TAG, "Unbound ${allBoundUseCases.size} use case(s)")
            } catch (e: Exception) {
                Log.w(TAG, "Error unbinding camera: ${e.message}")
            }
            allBoundUseCases.clear()
        }
        boundPreview = null
        boundAnalysis = null
        isBound = false
    }

    private fun pickSelector(provider: ProcessCameraProvider): CameraSelector? {
        val requested = CameraSelector.Builder().requireLensFacing(lensFacing).build()
        return when {
            provider.hasCamera(requested) -> requested
            provider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA) -> CameraSelector.DEFAULT_BACK_CAMERA
            provider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA) -> CameraSelector.DEFAULT_FRONT_CAMERA
            else -> null
        }
    }

    private fun fail(message: String) {
        Log.e(TAG, message)
        emit("camera_error", message)
    }

    /** Sends an event to JS so the UI can show it instead of failing silently. */
    private fun emit(event: String, message: String) {
        try {
            val reactContext = context as? ReactContext ?: return
            if (!reactContext.hasActiveReactInstance()) return
            val payload = Arguments.createMap().apply { putString("message", message) }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(event, payload)
        } catch (e: Exception) {
            Log.w(TAG, "Could not emit $event: ${e.message}")
        }
    }

    private data class Attempt(
        val name: String,
        val format: Int?,
        val withAnalysis: Boolean
    )
}

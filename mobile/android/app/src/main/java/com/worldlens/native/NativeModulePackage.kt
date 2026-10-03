package com.worldlens.native

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.worldlens.camera.CameraModule
import com.worldlens.ml.InferenceModule
import com.worldlens.tracking.TrackingModule
import com.worldlens.voice.VoiceModule

/**
 * Registers all WorldLens native Kotlin modules with React Native.
 *
 * Included modules:
 *   - CameraModule       (CameraX-based camera preview + frame analysis)
 *   - InferenceModule    (ONNX Runtime Mobile object detection)
 *   - TrackingModule     (Optional native IoU tracker)
 *   - VoiceModule        (Android SpeechRecognizer + TextToSpeech)
 */
class NativeModulePackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            CameraModule(reactContext),
            InferenceModule(reactContext),
            TrackingModule(reactContext),
            VoiceModule(reactContext)
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return listOf(
            com.worldlens.camera.CameraPreviewViewManager()
        )
    }
}

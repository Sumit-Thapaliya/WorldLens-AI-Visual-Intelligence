package com.worldlens.voice

import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale

/**
 * VoiceModule - Native voice interaction using Android's SpeechRecognizer + TextToSpeech.
 *
 * Exposes:
 *   - startListening() / stopListening() for speech-to-text
 *   - speak(text) for text-to-speech responses
 *   - isRecognitionAvailable(promise)
 */
class VoiceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var speechRecognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    @Volatile private var isListening = false
    @Volatile private var isTtsReady = false
    private var pendingSpeechText: String? = null

    override fun getName(): String = "VoiceModule"

    override fun initialize() {
        super.initialize()
        initTts(null)
    }

    private fun initTts(onReady: (() -> Unit)?) {
        UiThreadUtil.runOnUiThread {
            tts = TextToSpeech(reactContext) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    isTtsReady = true
                    tts?.language = Locale.US
                    tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                        override fun onStart(utteranceId: String?) {
                            emitEvent("voice_state", "speaking")
                        }
                        override fun onDone(utteranceId: String?) {
                            emitEvent("voice_state", "idle")
                        }
                        @Deprecated("Deprecated in Java")
                        override fun onError(utteranceId: String?) {
                            emitEvent("voice_state", "idle")
                        }
                    })
                    val pending = pendingSpeechText
                    if (pending != null) {
                        pendingSpeechText = null
                        speak(pending)
                    }
                    onReady?.invoke()
                } else {
                    isTtsReady = false
                }
            }
        }
    }

    @ReactMethod
    fun isRecognitionAvailable(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                val available = SpeechRecognizer.isRecognitionAvailable(reactContext)
                promise.resolve(available)
            } catch (e: Exception) {
                promise.resolve(false)
            }
        }
    }

    @ReactMethod
    fun startListening() {
        UiThreadUtil.runOnUiThread {
            try {
                if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
                    emitError("Speech recognition is not available on this device/emulator.")
                    emitEvent("voice_state", "idle")
                    return@runOnUiThread
                }

                speechRecognizer?.destroy()
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactContext).apply {
                    setRecognitionListener(object : RecognitionListener {
                        override fun onReadyForSpeech(params: Bundle?) {
                            isListening = true
                            emitEvent("voice_state", "listening")
                        }
                        override fun onBeginningOfSpeech() {
                            emitEvent("voice_state", "listening")
                        }
                        override fun onRmsChanged(rmsdB: Float) = Unit
                        override fun onBufferReceived(buffer: ByteArray?) = Unit
                        override fun onEndOfSpeech() {
                            isListening = false
                            emitEvent("voice_state", "processing")
                        }
                        override fun onError(error: Int) {
                            isListening = false
                            emitEvent("voice_state", "idle")
                            val errorMsg = when (error) {
                                SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
                                SpeechRecognizer.ERROR_CLIENT -> "Client side error"
                                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions (RECORD_AUDIO required)"
                                SpeechRecognizer.ERROR_NETWORK -> "Network error"
                                SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
                                SpeechRecognizer.ERROR_NO_MATCH -> "No speech recognized"
                                SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognition service busy"
                                SpeechRecognizer.ERROR_SERVER -> "Server error"
                                SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech input"
                                else -> "Speech recognition error: $error"
                            }
                            if (error != SpeechRecognizer.ERROR_NO_MATCH &&
                                error != SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                                emitError(errorMsg)
                            }
                        }
                        override fun onResults(results: Bundle?) {
                            isListening = false
                            emitEvent("voice_state", "idle")
                            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            val text = matches?.firstOrNull()
                            if (!text.isNullOrBlank()) {
                                emitEvent("voice_result", text)
                            }
                        }
                        override fun onPartialResults(partialResults: Bundle?) {
                            val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            val text = matches?.firstOrNull()
                            if (!text.isNullOrBlank()) {
                                emitEvent("voice_partial", text)
                            }
                        }
                        override fun onEvent(eventType: Int, params: Bundle?) = Unit
                    })
                }

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                }
                speechRecognizer?.startListening(intent)
            } catch (e: Exception) {
                isListening = false
                emitError(e.message ?: "Failed to start speech recognition")
                emitEvent("voice_state", "idle")
            }
        }
    }

    @ReactMethod
    fun stopListening() {
        UiThreadUtil.runOnUiThread {
            try {
                speechRecognizer?.stopListening()
            } catch (_: Exception) {}
            isListening = false
            emitEvent("voice_state", "idle")
        }
    }

    @ReactMethod
    fun speak(text: String) {
        UiThreadUtil.runOnUiThread {
            if (!isTtsReady || tts == null) {
                pendingSpeechText = text
                initTts {
                    tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "worldlens_${System.currentTimeMillis()}")
                }
                return@runOnUiThread
            }
            try {
                tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "worldlens_${System.currentTimeMillis()}")
            } catch (e: Exception) {
                emitError("TTS error: ${e.message}")
            }
        }
    }

    @ReactMethod
    fun isListening(promise: Promise) = promise.resolve(isListening)

    private fun emitEvent(name: String, value: String) {
        if (!reactContext.hasActiveReactInstance()) return
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, value)
    }

    private fun emitError(msg: String) {
        if (!reactContext.hasActiveReactInstance()) return
        val params = Arguments.createMap().apply { putString("error", msg) }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("voice_error", params)
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        UiThreadUtil.runOnUiThread {
            try {
                speechRecognizer?.destroy()
                speechRecognizer = null
                tts?.stop()
                tts?.shutdown()
                tts = null
            } catch (_: Exception) {}
        }
    }
}

package com.worldlens.voice

import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale

/**
 * VoiceModule - Native voice interaction using Android's SpeechRecognizer + TextToSpeech.
 *
 * Exposes:
 *   - startListening() / stopListening() for speech-to-text
 *   - speak(text) for text-to-speech responses
 *
 * Recognized text is emitted as a JS event "voice_result" so the JS layer can
 * parse it into commands (see voiceCommands.ts).
 */
class VoiceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var speechRecognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var isListening = false
    private var isTtsReady = false

    override fun getName(): String = "VoiceModule"

    override fun initialize() {
        super.initialize()
        initTts()
    }

    private fun initTts() {
        tts = TextToSpeech(reactContext) { status ->
            isTtsReady = status == TextToSpeech.SUCCESS
            tts?.language = Locale.getDefault()
        }
    }

    @ReactMethod
    fun startListening() {
        val activity = currentActivity ?: return

        if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
            emitError("Speech recognition not available on this device")
            return
        }

        speechRecognizer?.destroy()
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactContext).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    isListening = true
                    emitEvent("voice_state", "listening")
                }
                override fun onBeginningOfSpeech() = Unit
                override fun onRmsChanged(rmsdB: Float) = Unit
                override fun onBufferReceived(buffer: ByteArray?) = Unit
                override fun onEndOfSpeech() {
                    isListening = false
                    emitEvent("voice_state", "processing")
                }
                override fun onError(error: Int) {
                    isListening = false
                    emitEvent("voice_state", "idle")
                    if (error != SpeechRecognizer.ERROR_NO_MATCH &&
                        error != SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                        emitError("Speech recognition error: $error")
                    }
                }
                override fun onResults(results: Bundle?) {
                    isListening = false
                    emitEvent("voice_state", "idle")
                    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val text = matches?.firstOrNull()
                    if (text != null) {
                        emitEvent("voice_result", text)
                    }
                }
                override fun onPartialResults(partialResults: Bundle?) {
                    val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val text = matches?.firstOrNull()
                    if (text != null) emitEvent("voice_partial", text)
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
    }

    @ReactMethod
    fun stopListening() {
        speechRecognizer?.stopListening()
        isListening = false
        emitEvent("voice_state", "idle")
    }

    @ReactMethod
    fun speak(text: String) {
        if (!isTtsReady) {
            initTts()
            // Queue after init — for now simply log
            return
        }
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "worldlens_${System.currentTimeMillis()}")
        emitEvent("voice_state", "speaking")
    }

    @ReactMethod
    fun isListening(promise: Promise) = promise.resolve(isListening)

    private fun emitEvent(name: String, value: String) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, value)
    }

    private fun emitError(msg: String) {
        val params = Arguments.createMap().apply { putString("error", msg) }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("voice_error", params)
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        speechRecognizer?.destroy()
        speechRecognizer = null
        tts?.stop()
        tts?.shutdown()
        tts = null
    }
}

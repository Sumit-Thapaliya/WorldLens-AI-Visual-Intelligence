package com.worldlens.camera

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

/**
 * CameraPreviewViewManager - Exposes CameraPreviewView to React Native as <CameraPreviewView />.
 */
class CameraPreviewViewManager : SimpleViewManager<CameraPreviewView>() {

    override fun getName(): String = "CameraPreviewView"

    override fun createViewInstance(reactContext: ThemedReactContext): CameraPreviewView {
        return CameraPreviewView(reactContext)
    }

    @ReactProp(name = "facing")
    fun setFacing(view: CameraPreviewView, facing: String?) {
        view.setFacing(facing)
    }
}

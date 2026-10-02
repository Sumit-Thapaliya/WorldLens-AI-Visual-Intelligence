package com.worldlens

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * MainActivity for WorldLens.
 *
 * Hosts the React Native root view and registers Kotlin native modules
 * (camera, ML inference, tracking, voice) via NativeModulePackage.
 */
class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "WorldLens"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}

package com.facebook.react

import android.app.Application
import com.facebook.react.ReactPackage
import com.facebook.react.shell.MainReactPackage
import com.worldlens.native.NativeModulePackage

/**
 * Hand-written PackageList for WorldLens.
 * Only core RN + our native modules. Add community packages here later.
 */
class PackageList(private val application: Application) {
    val packages: List<ReactPackage> = listOf(
        MainReactPackage(null),
        NativeModulePackage()
    )
}

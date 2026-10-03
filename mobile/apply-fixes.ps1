# =============================================================================
#  WorldLens - apply ALL remaining fixes + verify + (optionally) rebuild
#
#  PUT THIS FILE IN:  C:\Users\Lenovo\Desktop\worldlens\mobile\apply-fixes.ps1
#
#  RUN IT (from a normal cmd.exe / PowerShell window):
#     cd C:\Users\Lenovo\Desktop\worldlens\mobile
#     powershell -ExecutionPolicy Bypass -File .\apply-fixes.ps1
#
#  To also clean-build, verify the APK actually contains the JS bundle, and
#  install it on the connected device, add -Build:
#     powershell -ExecutionPolicy Bypass -File .\apply-fixes.ps1 -Build
#
#  Safe to run repeatedly: every edit checks whether it is already applied.
# =============================================================================

param(
    [switch]$Build,
    [switch]$SkipTypecheck
)

$ErrorActionPreference = 'Continue'
$script:failed = $false

function Step($n, $m)  { Write-Host ""; Write-Host "[$n] $m" -ForegroundColor Cyan }
function Ok($m)        { Write-Host "     [OK]   $m" -ForegroundColor Green }
function Warn($m)      { Write-Host "     [WARN] $m" -ForegroundColor Yellow }
function Fail($m)      { $script:failed = $true; Write-Host "     [FAIL] $m" -ForegroundColor Red }
function Info($m)      { Write-Host "            $m" -ForegroundColor DarkGray }

# --- core helper: literal, line-ending-safe, UTF-8 (no BOM) text replacement --
function Edit-File {
    param([string]$Path, [string]$Old, [string]$New, [string]$Label)

    if (-not (Test-Path $Path)) { Fail "$Label - file not found: $Path"; return }

    $raw = [System.IO.File]::ReadAllText($Path)
    $txt = $raw -replace "`r`n", "`n"          # normalise to LF (repo files are LF)

    if ($txt.Contains($New)) { Ok "$Label (already applied)"; return }
    if (-not $txt.Contains($Old)) {
        Fail "$Label - expected code not found in $Path"
        Info "The file may already be fixed differently, or was hand-edited. Skipping."
        return
    }

    $out = $txt.Replace($Old, $New)
    [System.IO.File]::WriteAllText($Path, $out, (New-Object System.Text.UTF8Encoding($false)))
    Ok $Label
}

function Lines {
    param([string[]]$L)
    return ($L -join "`n")
}

Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "=============================================" -ForegroundColor White
Write-Host "  WorldLens - apply all remaining fixes"        -ForegroundColor White
Write-Host "=============================================" -ForegroundColor White

if (-not (Test-Path 'package.json') -or -not (Test-Path 'android/app/build.gradle')) {
    Fail "Wrong folder. Put this script in the 'mobile' folder next to package.json."
    Info "Expected: C:\Users\Lenovo\Desktop\worldlens\mobile\apply-fixes.ps1"
    exit 1
}
Info "folder: $PWD"

# =============================================================================
Step '1/5' 'Repairing the 3 config fixes (skipped if already correct)'
# =============================================================================

# --- android/app/build.gradle : keep the default assets dir -------------------
$gradlePath = 'android/app/build.gradle'
$gradle = ([System.IO.File]::ReadAllText($gradlePath)) -replace "`r`n", "`n"
if ($gradle.Contains('assets.srcDirs = ["src/main/assets", "../../assets"]')) {
    Ok 'build.gradle: src/main/assets is listed'
} elseif ($gradle.Contains('assets.srcDirs')) {
    $gradle = [regex]::Replace($gradle, 'assets\.srcDirs\s*=\s*\[[^\]]*\]',
                               'assets.srcDirs = ["src/main/assets", "../../assets"]')
    [System.IO.File]::WriteAllText($gradlePath, $gradle, (New-Object System.Text.UTF8Encoding($false)))
    Ok 'build.gradle: patched to include src/main/assets'
} else {
    Fail 'build.gradle: no assets.srcDirs line found - add it manually'
}

# --- package.json : main must be index.js ------------------------------------
$pkgPath = 'package.json'
$pkg = [System.IO.File]::ReadAllText($pkgPath)
if ($pkg -match '"main"\s*:\s*"index\.js"') {
    Ok 'package.json: "main" is index.js'
} else {
    $pkg = [regex]::Replace($pkg, '"main"\s*:\s*"[^"]*"', '"main": "index.js"')
    [System.IO.File]::WriteAllText($pkgPath, $pkg, (New-Object System.Text.UTF8Encoding($false)))
    Ok 'package.json: "main" set to index.js'
}
if ($pkg -match '"bundle:android"') {
    Ok 'package.json: bundle:android script present'
} else {
    Warn 'package.json: bundle:android script missing - run the bundle command manually'
}

# --- tsconfig.json : baseUrl must be gone ------------------------------------
$tsPath = 'tsconfig.json'
$ts = [System.IO.File]::ReadAllText($tsPath)
if ($ts -match '"baseUrl"') {
    $ts = [regex]::Replace($ts, '\s*"baseUrl"\s*:\s*"[^"]*"\s*,\s*\n', "`n")
    [System.IO.File]::WriteAllText($tsPath, $ts, (New-Object System.Text.UTF8Encoding($false)))
    Warn 'tsconfig.json: baseUrl removed (make sure "paths" targets start with ./ )'
} else {
    Ok 'tsconfig.json: no baseUrl'
}

# =============================================================================
Step '2/5' 'Applying the Kotlin fix (FPS readout keeps updating)'
# =============================================================================

$inf = 'android/app/src/main/java/com/worldlens/ml/InferenceModule.kt'
$infText = [System.IO.File]::ReadAllText($inf)

# The rewritten file (with real ONNX inference) already ships the fixed FpsCounter in a
# slightly different formatting, so detect it up-front rather than failing to match text.
if ($infText.Contains('private fun prune(now: Long)')) {
    Ok 'FpsCounter: already fixed (empty-deque guard + prune-on-read present)'
} else {

Edit-File -Path $inf -Label 'FpsCounter.tick guard' `
    -Old '        while (timestamps.first() < now - 1000) timestamps.removeFirst()' `
    -New '        while (timestamps.isNotEmpty() && timestamps.first() < now - 1000) timestamps.removeFirst()'

$newFps = Lines @(
    '    fun currentFps(): Double {',
    '        // Prune on read as well, otherwise the FPS readout stays frozen',
    '        // at its last value once frames stop arriving.',
    '        val now = System.currentTimeMillis()',
    '        while (timestamps.isNotEmpty() && timestamps.first() < now - 1000) timestamps.removeFirst()',
    '        return timestamps.size.toDouble()',
    '    }'
)
Edit-File -Path $inf -Label 'FpsCounter.currentFps prunes on read' `
    -Old '    fun currentFps(): Double = timestamps.size.toDouble()' -New $newFps

}   # end of the "FpsCounter not yet fixed" branch

# Is the real ONNX inference implementation in place, or only the old stub?
if (([System.IO.File]::ReadAllText($inf)).Contains('OrtEnvironment')) {
    Ok 'InferenceModule.kt: real ONNX inference present (detections are live)'
} else {
    Warn 'InferenceModule.kt: still the placeholder stub - detections stay simulated.'
    Info "For real detections, copy the new InferenceModule.kt + ModelRunner.kt from the"
    Info "workspace into android/app/src/main/java/com/worldlens/ml/ and re-run this script."
}

# =============================================================================
Step '3/5' 'Applying the TypeScript fixes (4 real type errors)'
# =============================================================================

# --- detector.ts : only use the native module when a model is really loaded ---
$det = 'src/services/detection/detector.ts'
$detText = [System.IO.File]::ReadAllText($det)

if ($detText.Contains('nativeModelLoaded')) {
    Ok 'detector.ts: already upgraded to model-aware detection (nothing to do)'
} else {

$flagBlock = Lines @(
    '// Set this to true once the ONNX model is actually shipped inside the APK',
    '// (generate it with python ai/scripts/convert_model.py, then place it at',
    '// mobile/assets/models/object_detector/model.quant.onnx).',
    '// InferenceModule.runInference() is still a stub that returns an empty list,',
    '// so with this flag OFF the mock detector drives the UI instead of showing',
    '// zero detections forever.',
    'export const NATIVE_MODEL_AVAILABLE = false;',
    '',
    'export function createDetector(config: DetectorConfig = DEFAULT_DETECTOR_CONFIG): DetectorHandle {'
)
Edit-File -Path $det -Label 'detector.ts: NATIVE_MODEL_AVAILABLE flag added' `
    -Old 'export function createDetector(config: DetectorConfig = DEFAULT_DETECTOR_CONFIG): DetectorHandle {' `
    -New $flagBlock

Edit-File -Path $det -Label 'detector.ts: honour the flag' `
    -Old '  if (native) return native;' `
    -New '  if (native && NATIVE_MODEL_AVAILABLE) return native;'

}   # end of the "detector.ts not yet upgraded" branch

# --- ScannerScreen.tsx : confidence is a display string, not a number ---------
Edit-File -Path 'src/screens/ScannerScreen.tsx' -Label 'ScannerScreen.tsx: confidence: string' `
    -Old 'onResult: (obj: { label: string; confidence: number; position: string; distance: string }) => void;' `
    -New 'onResult: (obj: { label: string; confidence: string; position: string; distance: string }) => void;'

# --- AppNavigator.tsx : fallback result used a number for a string field ------
$navPath = 'src/navigation/AppNavigator.tsx'
$navText = [System.IO.File]::ReadAllText($navPath)
if ($navText.Contains("confidence: '") -and -not $navText.Contains('confidence: 0,')) {
    Ok 'AppNavigator.tsx: confidence fallback already a string'
} else {
$navOld = ([System.IO.File]::ReadAllText($navPath)) -replace "`r`n", "`n"
if ($navOld.Contains("confidence: 0,")) {
    [System.IO.File]::WriteAllText($navPath, $navOld.Replace('              confidence: 0,',
        "              confidence: 'n/a',"), (New-Object System.Text.UTF8Encoding($false)))
    Ok 'AppNavigator.tsx: confidence fallback fixed'
} else {
    Warn 'AppNavigator.tsx: unexpected content around the confidence fallback - please eyeball it'
}
}

# --- FindObjectScreen.tsx : animationDelay is web-only, does nothing in RN ----
$fosPath = 'src/screens/FindObjectScreen.tsx'
$fosText = [System.IO.File]::ReadAllText($fosPath)
# Match the style PROPERTY ("animationDelay:"), not the word: the fixed file's explanatory
# comment also mentions animationDelay, which would otherwise look like an unfixed file.
if (-not $fosText.Contains('animationDelay:')) {
    Ok 'FindObjectScreen.tsx: no web-only animationDelay style (fine)'
} else {
$oldPips = Lines @(
    '                {[...Array(5)].map((_, i) => (',
    '                  <View key={i} style={[styles.wavePip, { animationDelay: `${i * 0.1}s` }]} />',
    '                ))}'
)
$newPips = Lines @(
    '                {[...Array(5)].map((_, i) => (',
    '                  <View',
    '                    key={i}',
    '                    style={[',
    '                      styles.wavePip,',
    '                      { height: 6 + ((i + 1) % 3) * 4, opacity: 0.45 + ((i + 1) % 3) * 0.25 },',
    '                    ]}',
    '                  />',
    '                ))}'
)
Edit-File -Path 'src/screens/FindObjectScreen.tsx' -Label 'FindObjectScreen.tsx: valid RN wave styles' `
    -Old $oldPips -New $newPips
}   # end of the "animationDelay still present" branch

if ($script:failed) {
    Write-Host ""
    Warn 'Some edits failed - see the [FAIL] lines above. Continuing to the build steps anyway.'
}

# =============================================================================
Step '4/5' 'Checking dependencies + types'
# =============================================================================

if (-not (Test-Path 'node_modules/react-native')) {
    Warn 'node_modules missing - running npm install (this takes a minute)...'
    & npm install
    if ($LASTEXITCODE -ne 0) { Fail 'npm install failed'; }
} else {
    Ok 'node_modules present'
}

if (-not $SkipTypecheck -and -not $script:failed) {
    # Always prefer the LOCAL compiler: calling bare "npx tsc" with no local install
    # downloads an unrelated decoy package also named "tsc".
    $localTsc = 'node_modules/.bin/tsc.cmd'
    if (Test-Path $localTsc) {
        Write-Host '     running node_modules/.bin/tsc --noEmit ...'
        $tsOut = & $localTsc --noEmit 2>&1
    } else {
        Warn 'local tsc not found - running npm run typecheck instead'
        $tsOut = & npm run --silent typecheck 2>&1
    }
    if ($LASTEXITCODE -eq 0) {
        Ok 'TypeScript: 0 errors'
    } else {
        Fail 'TypeScript still reports errors:'
        $tsOut | Select-Object -First 12 | ForEach-Object { Info $_ }
    }
}

# =============================================================================
Step '5/5' 'Regenerating the offline JS bundle'
# =============================================================================

$bundle = 'android/app/src/main/assets/index.android.bundle'
New-Item -ItemType Directory -Force -Path (Split-Path $bundle) | Out-Null

# NEVER delete the existing bundle before the new one exists: if bundling fails (JS error,
# missing node_modules, npx prompt) the app would be left with no offline JS at all - which is
# precisely the "Unable to load script" red box. Build to a temp file, verify it, only then swap.
$bundleTmp = "$bundle.tmp"
if (Test-Path $bundleTmp) { Remove-Item $bundleTmp -Force }

# Locally installed CLI first - bare "npx react-native" only works inside a folder that
# actually has node_modules, and on Windows the shim is react-native.cmd.
$localCli = $null
foreach ($candidate in @('node_modules/.bin/react-native.cmd', 'node_modules/.bin/react-native')) {
    if (Test-Path $candidate) { $localCli = $candidate; break }
}

Write-Host "     bundling to a temp file first (safe: the current bundle stays untouched)..."
if ($localCli) {
    Write-Host "     using $localCli"
    & $localCli bundle --platform android --dev false --entry-file index.js --bundle-output $bundleTmp
} else {
    Warn 'local react-native CLI not found - falling back to npx'
    & npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output $bundleTmp
}

$bundled = (Test-Path $bundleTmp) -and ((Get-Item $bundleTmp).Length -gt 100KB)
if ($LASTEXITCODE -ne 0 -or -not $bundled) {
    Fail 'Bundle generation failed - read the Metro output above'
    if (Test-Path $bundle) {
        Info 'Your existing index.android.bundle was NOT touched, so the app still runs.'
    } else {
        Warn 'No bundle exists in assets yet - the app needs Metro running until this succeeds.'
    }
    if (Test-Path $bundleTmp) { Remove-Item $bundleTmp -Force }
} else {
    $content = [System.IO.File]::ReadAllText($bundleTmp)
    if ($content.Contains('registerComponent')) {
        Move-Item -Force $bundleTmp $bundle
        $kb = [math]::Round((Get-Item $bundle).Length / 1KB)
        Ok "bundle written: $kb KB (contains the AppRegistry entry point)"
    } else {
        Fail 'new bundle looks wrong - it has no registerComponent call'
        Info 'Kept the previous bundle in place.'
        Remove-Item $bundleTmp -Force
    }
}

# =============================================================================
#  Optional: clean build + verify the APK really contains the bundle + install
# =============================================================================

if ($Build -and -not $script:failed) {

    Write-Host ""
    Write-Host "=============================================" -ForegroundColor White
    Write-Host "  Building app-debug.apk (clean)"                 -ForegroundColor White
    Write-Host "=============================================" -ForegroundColor White

    Push-Location android
    & .\gradlew.bat --stop | Out-Null
    Write-Host '     gradlew clean ...'
    & .\gradlew.bat clean | Out-Null
    Write-Host '     gradlew assembleDebug (first run: several minutes) ...'
    & .\gradlew.bat assembleDebug
    $buildExit = $LASTEXITCODE
    Pop-Location

    $apk = 'android/app/build/outputs/apk/debug/app-debug.apk'
    if ($buildExit -ne 0) {
        Fail "Gradle build failed (exit $buildExit) - scroll up for the first error"
    } elseif (-not (Test-Path $apk)) {
        Fail "Gradle said OK but $apk is missing"
    } else {
        Ok "APK built: $apk"

        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $apk).Path)
        $entry = $zip.Entries | Where-Object { $_.FullName -eq 'assets/index.android.bundle' } | Select-Object -First 1
        $zip.Dispose()

        if ($entry) {
            Ok ("VERIFIED: assets/index.android.bundle is inside the APK ({0} KB)" -f [math]::Round($entry.Length / 1KB))
        } else {
            Fail 'assets/index.android.bundle is NOT in the APK - this is the red box cause'
            Info 'Make sure step 1 reported build.gradle [OK], then re-run with -Build.'
        }

        $adb = Get-Command adb -ErrorAction SilentlyContinue
        if ($adb) {
            $dev = (adb devices) | Select-String '\sdevice$' | Select-Object -First 1
            if ($dev) {
                adb reverse tcp:8081 tcp:8081 | Out-Null
                Ok 'port 8081 reversed'
                Write-Host '     adb install -r ...'
                adb install -r $apk
                if ($LASTEXITCODE -eq 0) { Ok 'installed on device' } else { Warn 'adb install failed' }
            } else {
                Warn 'no device/emulator connected - skipped install'
            }
        } else {
            Warn 'adb not on PATH - install from Android Studio instead'
        }
    }
}

# =============================================================================
Write-Host ""
if ($script:failed) {
    Write-Host "  DONE with errors - read the [FAIL] lines above." -ForegroundColor Red
} else {
    Write-Host "  ALL FIXES APPLIED AND VERIFIED." -ForegroundColor Green
}
Write-Host ""
Write-Host "  Next:" -ForegroundColor White
if (-not $Build) {
    Write-Host "    powershell -ExecutionPolicy Bypass -File .\apply-fixes.ps1 -Build"
    Write-Host "      (clean build -> verify bundle inside APK -> install)"
    Write-Host ""
}
Write-Host "    then start Metro in another window (keep it open):"
Write-Host "      npx react-native start"
Write-Host ""
Write-Host "  Remember: run npm/npx commands from THIS folder (mobile\), never from the repo root."
Write-Host ""

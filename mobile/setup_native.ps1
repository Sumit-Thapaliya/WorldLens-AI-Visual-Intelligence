# ========================================================
#  WorldLens - Scaffold missing Android/iOS native files
#  Run this from inside the `mobile/` folder in PowerShell.
# ========================================================
#
# Usage:
#   cd mobile
#   powershell -ExecutionPolicy Bypass -File setup_native.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  WorldLens Native Scaffolding" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 0. Save node_modules if it exists
if (Test-Path node_modules) {
    Write-Host "[1/6] Saving existing node_modules..." -ForegroundColor Yellow
    if (Test-Path _nm_bak) { Remove-Item _nm_bak -Recurse -Force }
    Rename-Item node_modules _nm_bak
} else {
    Write-Host "[1/6] No node_modules folder to preserve." -ForegroundColor Yellow
}

# 1. Scaffold fresh RN 0.73 project into _scaffold
Write-Host "[2/6] Generating fresh RN 0.73.4 project into _scaffold/ ..." -ForegroundColor Yellow
if (Test-Path _scaffold) { Remove-Item _scaffold -Recurse -Force }
npx @react-native-community/cli@12 init _scaffold --version 0.73.4 --skip-install --skip-git-init
if (-not (Test-Path _scaffold/android/gradle/wrapper)) {
    Write-Host "ERROR: scaffold failed - check the npx output above" -ForegroundColor Red
    exit 1
}

# 2. Merge android scaffolding, KEEPING our existing build.gradle files
Write-Host "[3/6] Merging Android scaffolding (preserving our build.gradle + Kotlin)..." -ForegroundColor Yellow

# Gradle wrapper
New-Item -ItemType Directory -Force -Path .\android\gradle\wrapper | Out-Null
Copy-Item _scaffold\android\gradle\wrapper\*  .\android\gradle\wrapper\ -Force
Copy-Item _scaffold\android\gradlew          .\android\ -Force
Copy-Item _scaffold\android\gradlew.bat      .\android\ -Force
Copy-Item _scaffold\android\settings.gradle  .\android\ -Force
Copy-Item _scaffold\android\gradle.properties .\android\ -Force

# App-level scaffolding (proguard + mipmaps + res values/styles/drawables)
Copy-Item _scaffold\android\app\proguard-rules.pro .\android\app\ -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path .\android\app\src\main\res\values | Out-Null
Copy-Item _scaffold\android\app\src\main\res\mipmap-* .\android\app\src\main\res\ -Recurse -Force
Copy-Item _scaffold\android\app\src\main\res\drawable   .\android\app\src\main\res\ -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item _scaffold\android\app\src\main\res\values\strings.xml .\android\app\src\main\res\values\ -Force -ErrorAction SilentlyContinue
# Copy styles.xml only if we don't have one
if (-not (Test-Path .\android\app\src\main\res\values\styles.xml)) {
    Copy-Item _scaffold\android\app\src\main\res\values\styles.xml .\android\app\src\main\res\values\ -Force -ErrorAction SilentlyContinue
}
# Copy colors.xml / themes.xml if the scaffold has them
Copy-Item _scaffold\android\app\src\main\res\values\colors.xml .\android\app\src\main\res\values\ -Force -ErrorAction SilentlyContinue
Copy-Item _scaffold\android\app\src\main\res\values\themes.xml .\android\app\src\main\res\values\ -Force -ErrorAction SilentlyContinue
if (Test-Path _scaffold\android\app\src\main\res\xml) {
    Copy-Item _scaffold\android\app\src\main\res\xml .\android\app\src\main\res\ -Recurse -Force -ErrorAction SilentlyContinue
}

# 3. Merge iOS scaffolding (optional)
Write-Host "[4/6] Copying iOS scaffolding (optional)..." -ForegroundColor Yellow
if (Test-Path _scaffold\ios) {
    if (Test-Path ios) { Remove-Item ios -Recurse -Force }
    Copy-Item _scaffold\ios .\ -Recurse -Force -ErrorAction SilentlyContinue
}
Copy-Item _scaffold\Gemfile      .\ -Force -ErrorAction SilentlyContinue
Copy-Item _scaffold\Gemfile.lock .\ -Force -ErrorAction SilentlyContinue
Copy-Item _scaffold\.watchmanconfig .\ -Force -ErrorAction SilentlyContinue
Copy-Item _scaffold\.ruby-version  .\ -Force -ErrorAction SilentlyContinue
Copy-Item _scaffold\.editorconfig  .\ -Force -ErrorAction SilentlyContinue
Copy-Item _scaffold\.prettierrc.js .\ -Force -ErrorAction SilentlyContinue
Copy-Item _scaffold\.eslintrc.js   .\ -Force -ErrorAction SilentlyContinue
Copy-Item _scaffold\jest.config.js .\ -Force -ErrorAction SilentlyContinue

# 4. Cleanup
Write-Host "[5/6] Cleaning up..." -ForegroundColor Yellow
Remove-Item -Recurse -Force _scaffold
if (Test-Path _nm_bak) { Rename-Item _nm_bak node_modules -Force }

# 5. Install npm deps (pulls in react-native-svg + reanimated)
Write-Host "[6/6] Installing npm dependencies (react, react-native, react-native-svg, reanimated, onnxruntime-react-native)..." -ForegroundColor Yellow
npm install

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Done! Project is ready to build." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Make sure an Android emulator is running, or plug in a device with USB debugging."
Write-Host "  2. In one terminal:   npx react-native start --reset-cache" -ForegroundColor White
Write-Host "  3. In another:        npx react-native run-android" -ForegroundColor White
Write-Host ""
Write-Host "If you get 'SDK location not found', create android/local.properties with:"
Write-Host "  sdk.dir=C\:\\Users\\<YOU>\\AppData\\Local\\Android\\Sdk" -ForegroundColor DarkGray
Write-Host ""

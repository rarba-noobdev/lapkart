@echo off
setlocal

cd /d "%~dp0"

if "%CAP_SERVER_URL%"=="" (
  set "CAP_SERVER_URL=https://www.lapkart.store/"
)

echo Building LapKart Android debug APK for %CAP_SERVER_URL%
call npm run android:apk
if errorlevel 1 exit /b %errorlevel%

set "APK=android\app\build\outputs\apk\debug\app-debug.apk"
if not exist "%APK%" (
  echo APK not found: %APK%
  exit /b 1
)

where adb >nul 2>nul
if errorlevel 1 (
  echo Built %APK%
  echo adb was not found on PATH, so install/launch was skipped.
  exit /b 0
)

adb get-state >nul 2>nul
if errorlevel 1 (
  echo Built %APK%
  echo No Android device is connected, so install/launch was skipped.
  exit /b 0
)

adb install -r "%APK%"
if errorlevel 1 exit /b %errorlevel%

adb shell monkey -p com.lapkart.store -c android.intent.category.LAUNCHER 1

echo.
echo Installed and launched LapKart.
echo Press Ctrl+C to stop Android logs.
adb logcat Capacitor:D chromium:I AndroidRuntime:E *:S

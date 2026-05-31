$runtime = "C:\Users\DELL\Documents\Codex\2026-05-30\files-mentioned-by-the-user-lapkart-2\runtime\node-v22.16.0-win-x64"
$env:PATH = "$runtime;$env:PATH"
& "$runtime\npm.cmd" run dev -- --host 127.0.0.1 --port 5173

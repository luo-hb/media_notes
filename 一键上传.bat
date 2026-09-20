@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================
echo   Git Auto Push (via Clash Proxy 7897)
echo   Repo: %cd%
echo ============================================
echo.

set "PROXY=http://127.0.0.1:7897"
git config http.proxy  %PROXY%
git config https.proxy %PROXY%
echo [1/4] Proxy set to %PROXY%
echo.

git add -A
echo [2/4] All changes staged
echo.

git diff --cached --quiet
if %errorlevel%==0 (
    echo [3/4] No new changes, nothing to commit
) else (
    for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd-HH-mm"') do set "NOW=%%i"
    echo [3/4] Committing: %NOW%
    git commit -m "auto push %NOW%"
)
echo.

echo [4/4] Pushing to GitHub ...
git push origin HEAD
if %errorlevel%==0 (
    echo.
    echo ============================================
    echo   [OK] Pushed to GitHub successfully
    echo ============================================
) else (
    echo.
    echo ============================================
    echo   [FAIL] Push failed. Please check:
    echo     1. Is Clash Verge running?
    echo     2. Is system proxy enabled in Clash?
    echo     3. Is proxy port still 7897?
    echo ============================================
)

echo.
pause
endlocal

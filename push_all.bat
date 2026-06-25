@echo off
echo ===================================================
echo   E-Tracks Git Auto-Push Script (By Assistant)
echo ===================================================
echo.

echo [1/3] Adding changes...
git add .

echo [2/3] Committing changes...
git commit -m "Fix mobile navbar layout and horizontal scroll issues"

echo [3/3] Pushing to all remotes...
for /f "tokens=1" %%r in ('git remote') do (
    echo Pushing to %%r...
    git push %%r
)

echo.
echo ===================================================
echo   Done! 
echo ===================================================
pause

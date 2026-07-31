@echo off
echo ===================================================
echo   E-Tracks Git Auto-Push Script (By Assistant)
echo ===================================================
echo.

echo [1/3] Adding changes...
git add .

echo [2/3] Committing changes...
git commit -m "Fix mobile navbar layout and horizontal scroll issues"

echo [3/3] Pushing to the 3 specific repositories directly...

echo Pushing to amr2018/etracks...
git push https://github.com/amr2018/etracks.git HEAD:main

echo Pushing to omar-ahmed87/etracks...
git push https://github.com/omar-ahmed87/etracks.git HEAD:main

echo Pushing to omar-ahmed87/dtracks...
git push https://github.com/omar-ahmed87/dtracks.git HEAD:main

echo.
echo ===================================================
echo   Done! (Portfolio repo was ignored safely)
echo ===================================================
pause

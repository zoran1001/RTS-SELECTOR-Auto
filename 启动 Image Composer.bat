@echo off
chcp 65001 > nul
title Image Composer v0.6.0
cd /d "%~dp0"
echo Starting Image Composer...
electron .

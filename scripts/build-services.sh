#!/bin/bash
set -e

echo "Building C++ Utils Service..."
mkdir -p src/services/utils/build
cd src/services/utils/build
cmake ..
make -j$(nproc)
mkdir -p ../../../../dist/services
cp utils_server ../../../../dist/services/
echo "Utils Service built."

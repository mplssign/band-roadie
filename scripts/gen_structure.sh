#!/bin/bash
#
# Generate project structure documentation
# Cross-platform shell wrapper for the Node.js generator
#

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    echo "   Install Node.js: https://nodejs.org/"
    exit 1
fi

# Run the generator
node scripts/gen_structure.js

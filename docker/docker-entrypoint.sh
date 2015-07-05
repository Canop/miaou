#!/bin/bash
set -e

# Start container services here

# Execute default Dockerfile CMD or user passed command
exec "$@"

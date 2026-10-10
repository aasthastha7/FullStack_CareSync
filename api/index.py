"""Vercel serverless entry point for the CareSync FastAPI backend.

Adds the ``backend/`` folder to ``sys.path`` so that
``from app.main import app`` resolves correctly when Vercel
runs this file from the repo root.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.main import app  # noqa: E402
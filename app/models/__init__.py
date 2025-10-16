# models/__init__.py
"""Aggregates the primary ORM models for easy import."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

from ..extensions import db

_BASE_MODELS_MODULE = "app._base_models"
_BASE_MODELS_PATH = Path(__file__).resolve().parent.parent / "models.py"


def _load_base_models():
    """Load the legacy ``app/models.py`` module under a distinct name."""
    if _BASE_MODELS_MODULE in sys.modules:
        return sys.modules[_BASE_MODELS_MODULE]

    spec = importlib.util.spec_from_file_location(_BASE_MODELS_MODULE, _BASE_MODELS_PATH)
    if spec is None or spec.loader is None:
        raise ImportError(f"Unable to load base models module at {_BASE_MODELS_PATH}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[_BASE_MODELS_MODULE] = module
    spec.loader.exec_module(module)
    return module


_base_models = _load_base_models()

_public_exports = getattr(_base_models, "__all__", None)
if _public_exports is None:
    _public_exports = [name for name in dir(_base_models) if not name.startswith("_")]

for name in _public_exports:
    globals()[name] = getattr(_base_models, name)

if "db" in globals():
    db = globals()["db"]


__all__ = sorted(set(_public_exports + [name for name in globals() if not name.startswith("_")]))


# Import supplementary model modules so that SQLAlchemy registers them
from .daily_reward_models import *  # noqa: F401,F403
from .leaderboard_models import *  # noqa: F401,F403
from .referral_models import *  # noqa: F401,F403
from .season_pass_models import *  # noqa: F401,F403


__all__ = [name for name in globals() if not name.startswith("_")]




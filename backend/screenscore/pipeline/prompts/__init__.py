"""Versioned prompt files.

Prompts are data, not code: they live in files so runs are reproducible and
prompts are diffable/iterable. PROMPT_VERSION participates in every cache key
and in report metadata — bump it whenever ANY prompt file changes meaning,
so cached stage outputs from older prompts are never reused.

Templates use string.Template ($var) because prompt bodies are full of JSON
braces that str.format would mangle.
"""

from functools import lru_cache
from pathlib import Path
from string import Template

PROMPT_VERSION = "1.1"  # 1.1: specialists receive per-dimension retrieval packs

# The diff prompt versions independently: it caches nothing downstream, and
# bumping the pipeline PROMPT_VERSION would needlessly invalidate every
# map/specialist cache when only the comparison prompt changed.
DIFF_PROMPT_VERSION = "1.1"  # 1.1: computed dialogue overlap shown to the model

_DIR = Path(__file__).parent


@lru_cache(maxsize=None)
def load(name: str) -> Template:
    """load('map') → Template of prompts/map.txt; load('dimensions/dialogue') works too."""
    return Template((_DIR / f"{name}.txt").read_text())


def render(name: str, **variables: str) -> str:
    return load(name).substitute(**variables)

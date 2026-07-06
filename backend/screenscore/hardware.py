"""Hardware detection and model-tier recommendation (odysseus-style).

Detects RAM / Apple Silicon / NVIDIA GPU with stdlib only, then recommends a
two-tier model pairing: a small worker model for high-volume map passes and
the strongest reasoning model the machine can comfortably hold for scoring
and synthesis. On weak hardware both roles collapse onto the worker model
with an explicit depth warning — never a hard failure.

Interim Appendix-B defaults (operator to refine — see docs/DECISIONS.md):
lowest supported machine is 8 GB RAM, CPU-only.
"""

import os
import platform
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass, field

WORKER_MODEL = "llama3.1:8b"

# Approximate resident size (GB) of q4 weights + KV overhead at coverage-size
# contexts. Deliberately conservative; Apple Silicon oversubscription can hang
# the whole machine, so we round up.
MODEL_FOOTPRINT_GB = {
    "llama3.1:8b": 6.0,
    "qwen2.5:14b": 11.0,
    "qwen2.5:32b": 21.0,  # ~20 GB q4 weights + KV; must fit the canonical 24 GB card

    "llama3.3:70b": 45.0,
}

# Reasoning-tier ladder, strongest first.
REASONING_LADDER = ["qwen2.5:32b", "qwen2.5:14b", "llama3.1:8b"]
OPT_IN_70B = "llama3.3:70b"


@dataclass
class Hardware:
    os: str
    arch: str
    total_ram_gb: float
    apple_silicon: bool
    gpu: str  # "metal" | "cuda" | "none"
    vram_gb: float | None = None


@dataclass
class Recommendation:
    tier: str  # "minimum" | "standard" | "performance" | "max"
    worker_model: str
    reasoning_model: str
    model_budget_gb: float
    rationale: str
    warnings: list[str] = field(default_factory=list)
    optional_upgrade: str | None = None  # e.g. 70B on very large machines, opt-in

    def as_dict(self) -> dict:
        return asdict(self)


def _total_ram_gb() -> float:
    try:
        return os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES") / 1024**3
    except (ValueError, OSError, AttributeError):
        return 8.0  # unknown: assume the floor we support


def _nvidia_vram_gb() -> float | None:
    if not shutil.which("nvidia-smi"):
        return None
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5, check=True,
        ).stdout
        mibs = [float(line) for line in out.strip().splitlines() if line.strip()]
        return round(max(mibs) / 1024, 1) if mibs else None
    except (subprocess.SubprocessError, ValueError, OSError):
        return None


def detect() -> Hardware:
    apple_silicon = sys.platform == "darwin" and platform.machine() == "arm64"
    vram = _nvidia_vram_gb()
    if apple_silicon:
        gpu = "metal"
    elif vram is not None:
        gpu = "cuda"
    else:
        gpu = "none"
    return Hardware(
        os=sys.platform,
        arch=platform.machine(),
        total_ram_gb=round(_total_ram_gb(), 1),
        apple_silicon=apple_silicon,
        gpu=gpu,
        vram_gb=vram,
    )


def model_budget_gb(hw: Hardware) -> float:
    """How much memory we let a single loaded model occupy.

    Models run one-at-a-time (worker unloads before the reasoning model
    loads), so the budget applies to the largest single model.
    """
    if hw.gpu == "cuda" and hw.vram_gb:
        return round(hw.vram_gb * 0.9, 1)
    if hw.apple_silicon:
        # Unified memory is shared with the OS and the browser the user is
        # working in; oversubscribing MPS can freeze the machine. Cap at 50%.
        return round(hw.total_ram_gb * 0.5, 1)
    # CPU-only: leave headroom for OS + app, and stay conservative — big
    # models that merely *fit* in RAM are impractically slow without a GPU.
    return round(max(hw.total_ram_gb - 4.0, 2.0) * 0.6, 1)


def recommend(hw: Hardware) -> Recommendation:
    budget = model_budget_gb(hw)
    warnings: list[str] = []
    optional_upgrade = None

    reasoning = next(
        (m for m in REASONING_LADDER if MODEL_FOOTPRINT_GB[m] <= budget),
        WORKER_MODEL,
    )

    if reasoning == WORKER_MODEL:
        tier = "minimum"
        rationale = (
            f"~{budget} GB is available for a model, which fits the {WORKER_MODEL} class "
            "but not a larger reasoning model, so one model handles both map and "
            "reasoning passes."
        )
        warnings.append(
            "Both pipeline roles run on a single small model on this machine. "
            "Coverage will be complete but shallower — scores and synthesis benefit "
            "materially from a 14B+ reasoning model."
        )
        if MODEL_FOOTPRINT_GB[WORKER_MODEL] > budget:
            warnings.append(
                f"Even {WORKER_MODEL} is tight in ~{budget} GB; analysis will be slow "
                "and other applications should be closed during a run."
            )
    elif reasoning == "qwen2.5:14b":
        tier = "standard"
        rationale = (
            f"~{budget} GB fits a 14B-class reasoning model alongside the "
            f"{WORKER_MODEL} worker (loaded one at a time)."
        )
    else:
        tier = "performance"
        rationale = (
            f"~{budget} GB comfortably fits a 32B-class reasoning model for scoring "
            f"and synthesis, with {WORKER_MODEL} handling high-volume map passes."
        )
        if MODEL_FOOTPRINT_GB[OPT_IN_70B] <= budget:
            tier = "max"
            optional_upgrade = OPT_IN_70B
            rationale += (
                f" This machine could also run {OPT_IN_70B}; that is offered as an "
                "opt-in rather than the default because it is much slower per token."
            )

    if hw.apple_silicon:
        warnings.append(
            "Apple Silicon: model memory is capped at 50% of unified memory and "
            "Metal acceleration uses conservative limits, because oversubscribed "
            "MPS can freeze the machine."
        )

    return Recommendation(
        tier=tier,
        worker_model=WORKER_MODEL,
        reasoning_model=reasoning,
        model_budget_gb=budget,
        rationale=rationale,
        warnings=warnings,
        optional_upgrade=optional_upgrade,
    )

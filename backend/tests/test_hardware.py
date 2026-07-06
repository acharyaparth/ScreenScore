"""Tier recommendation table — the Appendix-B interim defaults."""

from screenscore.hardware import Hardware, recommend


def mac(ram):
    return Hardware(os="darwin", arch="arm64", total_ram_gb=ram, apple_silicon=True, gpu="metal")


def linux_cpu(ram):
    return Hardware(os="linux", arch="x86_64", total_ram_gb=ram, apple_silicon=False, gpu="none")


def linux_cuda(ram, vram):
    return Hardware(os="linux", arch="x86_64", total_ram_gb=ram, apple_silicon=False, gpu="cuda", vram_gb=vram)


def test_8gb_machine_collapses_to_single_small_model_with_warning():
    rec = recommend(mac(8))
    assert rec.tier == "minimum"
    assert rec.worker_model == rec.reasoning_model == "llama3.1:8b"
    assert any("shallower" in w for w in rec.warnings)


def test_never_hard_fails_even_below_floor():
    rec = recommend(mac(4))
    assert rec.reasoning_model == "llama3.1:8b"  # still recommends something


def test_16gb_mac_is_minimum_tier_due_to_unified_memory_cap():
    # 16 GB unified * 0.5 cap = 8 GB budget → 14B (11 GB) does not fit.
    rec = recommend(mac(16))
    assert rec.tier == "minimum"
    assert rec.model_budget_gb == 8.0


def test_32gb_mac_gets_14b_reasoning():
    rec = recommend(mac(32))
    assert rec.tier == "standard"
    assert rec.reasoning_model == "qwen2.5:14b"


def test_64gb_mac_gets_32b_reasoning():
    rec = recommend(mac(64))
    assert rec.tier == "performance"
    assert rec.reasoning_model == "qwen2.5:32b"


def test_128gb_mac_offers_70b_as_opt_in_not_default():
    rec = recommend(mac(128))
    assert rec.tier == "max"
    assert rec.reasoning_model == "qwen2.5:32b"  # default stays 32B
    assert rec.optional_upgrade == "llama3.3:70b"


def test_apple_silicon_always_warns_about_memory_cap():
    for ram in (8, 32, 128):
        assert any("unified memory" in w for w in recommend(mac(ram)).warnings)


def test_cuda_budget_uses_vram_not_ram():
    rec = recommend(linux_cuda(ram=64, vram=12))
    assert rec.model_budget_gb == 10.8
    assert rec.reasoning_model == "llama3.1:8b"  # 14B needs 11 GB, just misses


def test_cuda_24gb_gets_32b():
    rec = recommend(linux_cuda(ram=64, vram=24))
    assert rec.reasoning_model == "qwen2.5:32b"


def test_linux_cpu_16gb_gets_8b():
    rec = recommend(linux_cpu(16))
    assert rec.tier == "minimum"
    assert rec.reasoning_model == "llama3.1:8b"


def test_linux_cpu_32gb_gets_14b():
    rec = recommend(linux_cpu(32))
    assert rec.reasoning_model == "qwen2.5:14b"

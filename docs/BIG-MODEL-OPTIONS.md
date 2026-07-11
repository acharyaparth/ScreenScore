# Using stronger models without breaking the privacy promise

The 8B tier's judgment is visibly weak (the Big Fish logline missed the
story's spine). The question: paths to frontier-adjacent quality, ranked by
how much of "your script never leaves your machine" each one preserves.

The promise today is **physical**: the script and the model share a machine.
Every option below either keeps that, or replaces it with a different kind of
guarantee — and the difference must be stated to the user in plain words,
never blurred.

## Option 0 — Bigger open models on bigger local hardware *(promise intact)*

Qwen3.6-27B-class models are a large step up from 8B and fit a 32–64 GB Mac
or a single 24 GB GPU. Cost is hardware (~$2–4k Mac Studio class), not
architecture. **This is what the eval decides:** if 27B-class clears the
quality bar, the answer is "recommend better hardware," and the promise never
changes. Decide here first; everything below is contingency.

## Option 1 — Your own remote runtime *(promise: "your machine" → "your infrastructure")*

The user runs Ollama on a box THEY control — a GPU VM in their own cloud
account, a workstation at the office — and points ScreenScore at it. The
mechanism already exists (`OLLAMA_URL` + `SCREENSCORE_ALLOW_REMOTE_RUNTIME=1`,
built as a guard, usable as a feature). Script text transits to hardware the
user rents and can wipe. Not zero-trust (the cloud provider could in theory
inspect VM memory), but no third-party *service* ever sees the script and
nothing is retained by anyone but the user.

Cheap to productize: documentation + UI labeling ("Remote runtime: your own
server — you are trusting that machine"). Worth shipping regardless of the
eval outcome, for power users.

## Option 2 — Confidential computing / TEE inference *(promise restated: "provably unreadable by anyone else")*

NVIDIA H100/H200/B200-class GPUs support confidential-compute mode: the
model runs inside a hardware-attested enclave with encrypted VRAM and bus;
the user's client verifies a signed attestation that the expected code is
running before sending anything; measured overhead is ~4–8% for LLM
inference. The guarantee changes character — from "never leaves" to
"leaves encrypted into hardware that provably cannot be read, even by the
operator" — which is arguably the strongest privacy claim available beyond
physical possession (it is the Apple Private Cloud Compute architecture).

Honest costs: trust shifts to hardware vendors' root of trust + our
attestation client being right; the stack is young; self-hosting a CC VM is
DIY-heavy and managed offerings vary. **This is a research spike, not a
sprint** — only worth it if Option 0 fails the eval. If pursued: ScreenScore
would verify attestation client-side and show the user exactly what was
proven.

## Option 3 — Vendor APIs with zero-data-retention terms *(promise broken, replaced by a contract)*

Frontier quality, trivial integration, and the guarantee becomes legal
("provider promises not to retain/train") instead of technical. For the
audience ScreenScore courts — writers whose core anxiety is their unreleased
IP feeding someone's model — a contract is not the product. If ever offered,
it must be a per-project opt-in labeled as bluntly as this paragraph, and it
is effectively a different product tier.

## Rejected: "cloud sees only the digest"

Sending a de-quoted digest to a big cloud model leaks less *text* but the
story itself — which IS the IP — is fully present in any digest good enough
to score from. A privacy fig leaf; not offered.

## Recommendation

1. Run the eval (Phase B) — the whole question may dissolve if 27B-class
   judges well. The minimum tier stays honest either way: weak hardware gets
   real warnings, not fake depth.
2. Ship Option 1 as a documented power path now.
3. Spike Option 2 only if the eval says open ≤32B models aren't enough.
4. Hold the line on Option 3 unless users demand it with eyes open.

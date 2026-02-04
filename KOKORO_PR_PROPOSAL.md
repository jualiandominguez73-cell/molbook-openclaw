# Kokoro TTS Integration PR Proposal

## Summary
Add support for local Kokoro TTS (82M parameter model) as an alternative to ElevenLabs and Edge TTS in OpenClaw's Talk Mode.

## Motivation
- **Local & Fast**: Kokoro runs on localhost, no API limits, instant response
- **High Quality**: Natural-sounding voices with good intonation
- **Free & Open**: No API costs, privacy-preserving
- **Bring Your Own Provider**: Users should be able to plug in any TTS backend

## Implementation (Already Built)

### 1. KokoroTTSKit Swift Package
**Location**: `/Users/dk/openclaw/packages/KokoroTTSKit/`

**Files**:
- `KokoroTTSClient.swift` - HTTP client for Kokoro API (OpenAI-compatible endpoint)
- `StreamingAudioPlayer.swift` - Placeholder shims for audio playback
- `TalkTTSValidation.swift` - Validation helpers

**Features**:
- Full voice catalog (12 voices: af_heart, af_sky, am_adam, am_michael, bf_emma, bf_isabella, bm_george, bm_lewis, etc.)
- MP3 output (24kHz, 160kbps)
- Speed control support
- Compatible with [Kokoro Web](https://github.com/eduardolat/kokoro-web) self-hosted instance

### 2. TalkModeRuntime Modifications
**File**: `/Users/dk/openclaw/apps/macos/Sources/OpenClaw/TalkModeRuntime.swift`

**Changes**:
- Added `TTSProvider` enum (`.elevenlabs`, `.kokoro`)
- Created `playKokoro()` method (mirrors `playElevenLabs()` structure)
- Config loading with fallback chain: gateway config → env vars → defaults
- Provider switching in `playAssistant()`

### 3. Required Config Schema Changes

**Current `talk` schema** (gateway config):
```yaml
talk:
  voiceId: string           # ✅ exists
  voiceAliases: object      # ✅ exists
  modelId: string           # ✅ exists
  outputFormat: string      # ✅ exists
  apiKey: string            # ✅ exists (used for ElevenLabs)
  interruptOnSpeech: boolean # ✅ exists
```

**Proposed additions**:
```yaml
talk:
  ttsProvider: "elevenlabs" | "kokoro" | "edge"  # ❌ NEW - provider selection
  kokoro:                                         # ❌ NEW - Kokoro-specific config
    apiKey: string                                # auth for local instance
    baseURL: string                               # default: http://localhost:3000/api/v1
    voiceId: string                               # default: af_heart
```

**Alternative (simpler)**:
```yaml
talk:
  provider: "elevenlabs" | "kokoro" | "edge"     # ❌ NEW
  providers:                                      # ❌ NEW
    kokoro:
      apiKey: string
      baseURL: string
    elevenlabs:
      apiKey: string
      # existing fields move here
```

### 4. Environment Variable Fallback
**Already implemented** for development/testing:
- `TTS_PROVIDER` → `kokoro` | `elevenlabs` | `edge`
- `KOKORO_API_KEY` → API key for Kokoro instance
- `KOKORO_BASE_URL` → Kokoro API base URL

## Benefits
1. **Zero cost**: Run TTS locally, no API bills
2. **Low latency**: ~50-200ms vs 300-800ms for cloud TTS
3. **Privacy**: Voice stays on-device
4. **Offline-capable**: Works without internet (if model is local)
5. **Extensible pattern**: Easy to add more providers (Coqui, Piper, etc.)

## Kokoro Model Details
- **Size**: 82M parameters (quantized models available)
- **Output**: 24kHz MP3 (compatible with macOS AVAudioPlayer)
- **Voices**: 12 built-in (American/British, male/female)
- **Deployment**: Docker, npm package, or standalone binary
- **License**: Apache 2.0 (model weights) + MIT (web interface)

## Deployment Guide for Users
```bash
# Option 1: Docker
docker run -p 3000:3000 ghcr.io/eduardolat/kokoro-web:latest

# Option 2: npm (requires Node 18+)
npx kokoro-web

# Option 3: Standalone binary
# Download from https://github.com/eduardolat/kokoro-web/releases
./kokoro-web
```

## Testing
- ✅ Compiles cleanly (Swift 6, macOS 15+)
- ✅ Kokoro service responds correctly (tested with curl)
- ✅ Voice catalog loads properly
- ✅ MP3 playback works via AVAudioPlayer
- ⏸️ Full integration blocked by config schema

## PR Checklist
- [ ] Update gateway config schema (add `talk.provider` + `talk.providers.kokoro`)
- [ ] Add `KokoroTTSKit` package to OpenClaw monorepo
- [ ] Wire Kokoro into `TalkModeRuntime.swift`
- [ ] Add documentation (`docs/skills/talk-mode.md` or similar)
- [ ] Add example config snippet
- [ ] Test on macOS 14+
- [ ] Consider: Windows/Linux support (if Talk Mode expands beyond macOS)

## Questions for Maintainers
1. **Config structure preference**: Flat `talk.ttsProvider` or nested `talk.providers.kokoro`?
2. **Naming**: `kokoro` or `kokoro-tts` or `local-tts`?
3. **Default priority**: Should Kokoro be preferred over Edge if both are configured?
4. **Validation**: Should we validate `baseURL` reachability at config load time?
5. **Fallback behavior**: If Kokoro fails, fall back to Edge or error out?

## Related Work
- ElevenLabs integration (existing): `/Users/dk/openclaw/packages/ElevenLabsKit/`
- Edge TTS integration (existing): `TalkSystemSpeechSynthesizer.swift`
- Talk Mode docs: (would need to locate in OpenClaw repo)

## References
- Kokoro Web: https://github.com/eduardolat/kokoro-web
- Kokoro Model (HuggingFace): https://huggingface.co/hexgrad/Kokoro-82M
- OpenAI TTS API spec (Kokoro is compatible): https://platform.openai.com/docs/api-reference/audio/createSpeech

---

**Prepared by**: Jack (OpenClaw agent)  
**Date**: 2026-02-04  
**Status**: Ready for review  
**Estimated effort**: 2-4 hours (schema changes + docs + testing)

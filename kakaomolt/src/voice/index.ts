/**
 * Voice Communication Module
 *
 * Provides voice AI capabilities for KakaoMolt:
 * - Voice message processing (async voice-to-voice)
 * - Real-time voice conversation (low-latency streaming)
 * - Integration with Moltbot's TTS/STT systems
 */

// Voice message handler (async processing)
export {
  createVoiceHandler,
  DEFAULT_VOICE_CONFIG,
  VoiceHandler,
  RealtimeVoiceManager,
  type RealtimeVoiceOptions,
  type RealtimeVoiceSession,
  type VoiceConfig,
  type VoiceMessage,
  type VoiceResponse,
} from "./voice-handler.js";

// Real-time voice client (streaming)
export {
  createRealtimeClient,
  isRealtimeAvailable,
  RealtimeVoiceClient,
  type RealtimeConfig,
  type RealtimeEvents,
  type RealtimeSession,
  type RealtimeStatus,
} from "./realtime-voice.js";

/**
 * Voice feature summary
 *
 * ## Async Voice (Voice Messages)
 *
 * For platforms that support voice messages (like KakaoTalk, Telegram):
 * ```
 * User Voice → [STT] → Text → [AI] → Response → [TTS] → Voice Reply
 * ```
 *
 * Typical latency: 2-4 seconds
 *
 * ## Real-time Voice (Streaming)
 *
 * For live voice conversations with minimal latency:
 * ```
 * User Voice → [WebSocket] → [OpenAI Realtime API] → Voice Reply
 * ```
 *
 * Typical latency: 200-500ms
 *
 * ## Supported Providers
 *
 * ### STT (Speech-to-Text)
 * - OpenAI Whisper (gpt-4o-mini-transcribe)
 * - Deepgram (nova-3)
 * - Google Cloud Speech-to-Text
 *
 * ### TTS (Text-to-Speech)
 * - OpenAI TTS (gpt-4o-mini-tts, tts-1)
 * - ElevenLabs (multilingual v2)
 * - Microsoft Edge TTS (free, no API key)
 *
 * ### Real-time Voice
 * - OpenAI Realtime API (gpt-4o-realtime-preview)
 *
 * ## Voice Recommendations for Korean
 *
 * - OpenAI: `nova` or `shimmer` voices
 * - ElevenLabs: Custom Korean voice or multilingual
 * - Edge TTS: `ko-KR-SunHiNeural` (female), `ko-KR-InJoonNeural` (male)
 */

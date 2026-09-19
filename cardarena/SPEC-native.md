# SPEC · Native plugin contract (Swift ⇄ Unity)

The only native code in the app: a static framework `CardArenaNative.framework` exposing iOS
Vision (rectangles, text), Speech, and TTS to Unity through a C ABI. Deliberately tiny
(~300 lines of Swift) and event-driven so the Unity side never blocks.

## 1. Principles

1. **Every call is non-blocking.** Native work runs on its own queues; results come back as
   events through one callback.
2. **One callback, JSON payloads.** All events are UTF-8 JSON strings with `type`, `seq`, `t`
   (seconds since `ca_init`). Payloads are small (< 4 KB) — images cross as temp-file paths.
3. **Unity owns threading.** The C# callback only enqueues; a `NativeEvents` MonoBehaviour
   drains the queue on the main thread every frame.
4. **Strings are copied inside the callback.** Native frees the buffer when the callback
   returns; C# must `Marshal.PtrToStringUTF8` before returning.
5. **An Editor mock implements the same interface**, emitting scripted events, so the whole
   game runs in the Unity Editor without a device.

## 2. C ABI

```c
typedef void (*ca_event_cb)(const char* json_utf8);

// lifecycle
int  ca_init(ca_event_cb cb);                 // once; returns 0 or error code
void ca_shutdown(void);
void ca_set_log_level(int level);             // 0 error, 1 info, 2 debug

// permissions
void ca_request_permissions(int mask);        // 1 mic, 2 speech; emits permission.result

// vision
int  ca_vision_start(const char* config_json);
void ca_vision_stop(void);
void ca_vision_tick(void* ar_session_ptr);    // call from Update at the desired rate; native throttles to config.hz
void ca_vision_capture_rect(const char* rect_id); // emits vision.crop with a PNG path

// speech
int  ca_speech_start(const char* config_json);
void ca_speech_stop(void);
void ca_speech_set_context(const char* json); // replace contextual strings without restarting

// text-to-speech
void ca_tts_speak(const char* json);          // {"text","rate":0.5,"voice":"en-US"}
void ca_tts_stop(void);
```

`ar_session_ptr` is the `ARSession*` obtained from AR Foundation's ARKit subsystem
(`XRSessionSubsystem.nativePtr` → `UnityXRNativeSession.sessionPtr`). Native reads
`session.currentFrame.capturedImage` directly — no pixel copy through managed memory.

## 3. Configs

**Vision** — `ca_vision_start`:
```jsonc
{
  "hz": 10,                                  // SCANNING rate; app drops to 2 once both cards lock
  "zones": [ { "id": "left",  "rect": [0.0, 0.0, 0.5, 1.0] },
             { "id": "right", "rect": [0.5, 0.0, 0.5, 1.0] } ],   // normalized x,y,w,h in frame
  "card": { "aspect": 0.716, "aspectTolerance": 0.08, "minSizeFrac": 0.08, "maxPerZone": 2 },
  "rectify": { "width": 512, "height": 716 },
  "bands":  { "name":   [0.05, 0.03, 0.60, 0.09],     // normalized within the rectified card
              "number": [0.02, 0.90, 0.35, 0.07] },
  "ocr":    { "level": "accurate", "languages": ["en-US"], "minConfidence": 0.4 }
}
```
Native runs `VNDetectRectanglesRequest` per zone, rectifies each candidate with a
perspective transform, then `VNRecognizeTextRequest` on the two bands only. Identity
matching against the card DB is done in C# (it owns the DB); native returns raw text.

**Speech** — `ca_speech_start`:
```jsonc
{
  "locale": "en-US",
  "onDevice": true,
  "partialResults": true,
  "contextualStrings": ["Charizard", "Fire Spin", "Flamethrower", "go", "cancel"],
  "maxSeconds": 8,                           // auto-stop; push-to-talk release stops earlier
  "duckOthers": true                         // AVAudioSession .duckOthers while listening
}
```
Implementation: `SpeechAnalyzer` + `SpeechTranscriber` on iOS 26+, `SFSpeechRecognizer`
with `requiresOnDeviceRecognition = true` otherwise. Contextual biasing is applied where the
API supports it; the C# matcher (SPEC-app §8) is the source of truth either way.
Audio session category `.playAndRecord`, mode `.measurement`, options
`[.duckOthers, .allowBluetooth]`; the app's own mixer snapshot handles TV ducking.

## 4. Events

| `type` | Payload | Notes |
|---|---|---|
| `permission.result` | `{mic: "granted"\|"denied", speech: ...}` | |
| `vision.rects` | `{zone, rects: [{id, corners: [[x,y]×4], confidence}]}` | normalized frame coords; ids stable across frames while tracked |
| `vision.text` | `{zone, rectId, name: {text, confidence}, number: {text, confidence}, elapsedMs}` | either field may be empty |
| `vision.crop` | `{rectId, path, width, height, blur}` | rectified PNG in `tmp/`; `blur` = variance of Laplacian, higher is sharper |
| `speech.state` | `{listening: bool, reason}` | reason: `started`, `stopped`, `timeout`, `background`, `error` |
| `speech.partial` | `{text, confidence}` | |
| `speech.final` | `{text, confidence, alternatives: [{text, confidence}]}` | up to 5 alternatives; C# matches all |
| `speech.error` | `{code, message}` | |
| `tts.done` | `{}` | question timer starts after this |
| `error` | `{domain, code, message}` | domain: vision, speech, tts, session |

Every event also carries `seq` (monotonic) and `t`.

## 5. Unity side *(Unity)*

- `CardArena.Native.Bridge` — static class with the `[DllImport("__Internal")]` declarations
  and a `[MonoPInvokeCallback(typeof(EventCb))]` static callback that copies the string and
  enqueues it on a `ConcurrentQueue<string>`.
- `NativeEvents : MonoBehaviour` — drains the queue in `Update`, parses `type`, and raises typed
  C# events (`OnRects`, `OnText`, `OnCrop`, `OnSpeechFinal`, …). Parse with a tolerant JSON
  reader; unknown types are logged and dropped.
- `INativeBackend` interface with two implementations: `IosBackend` (P/Invoke) and
  `EditorMockBackend` (reads `Assets/Editor/MockScripts/*.json` timelines and emits events on
  a schedule, plus keyboard shortcuts to emit ad-hoc `speech.final`).
- Lifecycle: `ca_init` in `Awake` of a persistent object; `ca_speech_stop` + `ca_vision_stop`
  on `OnApplicationPause(true)`; re-arm on resume. Native also auto-stops speech when the
  app backgrounds and emits `speech.state{reason: background}`.
- Info.plist: `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`,
  `NSSpeechRecognitionUsageDescription`.

## 6. Runtime reference images (ties §2.2 of SPEC-app to this contract)

On card lock, C# calls `ca_vision_capture_rect(rectId)`. The returned crop is the
**preferred** `ARReferenceImage` source (it matches lighting, sleeve, and print exactly);
if `blur` is below threshold or AR Foundation's
`MutableRuntimeReferenceImageLibrary.ScheduleAddImageWithValidationJob` reports the image
lacks features, fall back to the card DB art. Physical width 63 mm in both cases.

## 7. Failure modes to handle explicitly

- Speech permission denied → tap-only mode, one-time banner; never re-prompt mid-battle.
- Vision returning rects but no text for > 2.5 s → unknown-card flow (SPEC-app §2.5).
- Audio route change (HDMI plugged/unplugged) → native re-activates the audio session and
  emits `speech.state`; C# restarts listening only if push-to-talk is still held.
- Thermal pressure → C# lowers `hz` to 4 while in `SCANNING`, 1 while locked.

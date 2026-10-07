# LinguaTube

LinguaTube turns a supported YouTube URL into a structured language lesson with a bilingual transcript, vocabulary, grammar, five exercise formats, answer feedback, and progress tracking.

The default workflow extracts the selected video's captions with `yt-dlp` first. If usable captions are unavailable, Gemini analyzes the video URL. Each lesson records which source was actually used. A deterministic demo transcript remains available only when explicitly selected for offline development.

## Run locally

Requires a current Node.js LTS release, npm, and a working `yt-dlp` executable. The local development wrapper `.local/bin/yt-dlp-local` requires Python 3.11 and the standalone `yt-dlp` payload at `.local/bin/yt-dlp`; otherwise install `yt-dlp` on `PATH` or set `YT_DLP_PATH` to an absolute executable path. Gemini fallback and Vietnamese translation require a server-side `GEMINI_API_KEY`.

```bash
cp .env.example .env.local
npm install
npm run dev
```

The environment template selects Gemini. Fill `GEMINI_API_KEY` before starting the server, then open `http://localhost:3000`:

```text
AI_PROVIDER=gemini
TRANSCRIPT_PROVIDER=youtube
YT_DLP_PATH=
MOCK_JOB_STEP_DELAY_MS=180
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_TIMEOUT_MS=45000
GEMINI_VIDEO_TIMEOUT_MS=180000

# Optional legacy OpenRouter rollback configuration
OPENROUTER_API_KEY=
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free
OPENROUTER_FALLBACK_MODELS=openrouter/free
OPENROUTER_TIMEOUT_MS=45000
```

Use a public `youtube.com/watch?v=…`, `youtu.be/…`, or `youtube.com/embed/…` URL with an 11-character video ID. URL validation alone does not prove the video is accessible; a private, region-restricted, or unavailable video can still fail during extraction. The app reports that failure instead of substituting sample content.

`TRANSCRIPT_PROVIDER=youtube` tries manually supplied captions through `yt-dlp`, then automatic captions, before using Gemini video understanding. The provider saves the transcript source and time coverage with the lesson. The interface distinguishes original caption timestamps from Gemini-estimated timestamps. Transcript playback in the browser currently uses speech synthesis, so it reads the extracted text with a synthetic voice.

When captions are absent, Gemini processes consecutive 60-second video windows with a one-second overlap, using the duration obtained from `yt-dlp`. A verified duration is cached for 30 days under `.local/cache/youtube-duration/` so a later temporary YouTube connection failure can still use timed windows. The app always attempts `yt-dlp` first. If neither YouTube metadata nor a verified cached duration is available, it cannot verify full-video coverage and the job fails instead of saving a partial lesson. The current transcription limit is 60 minutes; lesson generation also has explicit transcript-size limits. Gemini-derived speech and timestamps should be checked against the original video when exact wording matters.

The lesson cache key includes the transcript strategy and model, but it is computed before fetching captions. If a video's captions change while the server is running, use the explicit lesson regeneration action to fetch them again.

For offline fixtures, explicitly set `TRANSCRIPT_PROVIDER=mock` and `AI_PROVIDER=mock`. This mode uses a short sample dialogue unrelated to the submitted video and is labeled as such in the app. Restart the server after changing providers; the in-memory service container is cached for the process lifetime.

## Gemini AI mode (recommended)

To use Gemini directly, create a key in Google AI Studio and set these values only in your private server environment. Gemini provider initialization will fail until `GEMINI_API_KEY` is filled:

```text
AI_PROVIDER=gemini
GEMINI_API_KEY=<server-only value>
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_TIMEOUT_MS=45000
TRANSCRIPT_PROVIDER=youtube
```

`GEMINI_MODEL` is optional; an omitted or blank value selects `gemini-3.1-flash-lite`. The timeout accepts 1,000–120,000 milliseconds and defaults to 45,000. The provider sends strict JSON Schema requests directly to the Gemini Developer API and keeps the key in the server-only `x-goog-api-key` header. Never use a `NEXT_PUBLIC_*` variable for this key.

Restart the server after changing the provider, model, key, or timeout. The service container is cached for the server process lifetime. To roll back, set `AI_PROVIDER=mock` or `AI_PROVIDER=openrouter`, configure that provider, and restart.

Gemini lesson generation sends the transcript text to Google. Google's free-tier and paid-tier data handling differ: free-tier content may be used to improve Google products, while paid services have different data-use terms. Do not submit confidential, private, or personal transcript content without a separate privacy and data-processing review. Check Google's current [Gemini API terms](https://ai.google.dev/gemini-api/terms) before production use.

### Cost and limits

Caption extraction with `yt-dlp` does not send video media to Gemini. The app still uses Gemini for transcript translation and lesson generation. When no usable captions exist, video understanding adds model usage and may reach quota or output limits. Charges vary with video length, generated content, retries, and the account's current tier. Check the official [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) before estimating a specific video. A failed or incomplete extraction stops the lesson rather than presenting sample dialogue as video content.

### Optional Gemini smoke checks

The one-call and full-pipeline smokes require both an explicit flag and `GEMINI_API_KEY` in the private server environment. With either gate missing, they skip and make no network request:

```bash
GEMINI_LIVE_SMOKE=1 npm run smoke:gemini
GEMINI_FULL_PIPELINE_SMOKE=1 npm run smoke:gemini:pipeline
```

The one-call smoke uses only synthetic, non-personal text. The full-pipeline smoke uses `MockTranscriptProvider`, makes about eight serial logical generation calls before any bounded structured-output repairs, and has an eight-minute deadline. Set `GEMINI_FULL_PIPELINE_FOCUS` to `comprehensive`, `speaking`, `listening`, or `grammar` to select the focus. Neither smoke prints the key, prompts, transcript, generated content, or raw provider response.

## OpenRouter AI mode

Mock AI needs no provider credential. To use the legacy OpenRouter server-side provider, set these values in your private server environment without committing the key:

```text
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=<server-only value>
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free
OPENROUTER_FALLBACK_MODELS=openrouter/free
OPENROUTER_TIMEOUT_MS=45000
TRANSCRIPT_PROVIDER=youtube
```

`OPENROUTER_MODEL` is optional in real mode. An omitted or blank value selects the Nemotron 3 Super free primary model shown above. `OPENROUTER_FALLBACK_MODELS` is a comma-separated priority list sent through OpenRouter's `models` routing; the checked-in default is `openrouter/free`. When the primary model or its providers return an eligible error, OpenRouter tries the configured fallbacks in order. Leave the fallback variable blank to disable cross-model fallback. The timeout accepts 1,000–120,000 milliseconds and defaults to 45,000. See OpenRouter's [model fallback documentation](https://openrouter.ai/docs/guides/routing/model-fallbacks) for the routing rules.

Restart the server after changing the provider, primary model, fallback list, or other environment settings. The service container is cached for the life of the server process, so a running process does not partially switch routing configuration. To roll back immediately, set `AI_PROVIDER=mock` and restart the server.

OpenRouter changes lesson generation only; YouTube caption extraction and Gemini transcript fallback remain configured separately through `TRANSCRIPT_PROVIDER=youtube`. Free-model quota and availability can cause generation to fail, and repair attempts can consume additional calls. Cache reuse avoids a new generation call set, while explicit regeneration consumes quota again.

Real mode sends the transcript text used for generation to OpenRouter and the infrastructure hosting whichever configured model ultimately handles the request. That includes NVIDIA infrastructure for the default primary model and may include another provider selected by the `openrouter/free` fallback router. Free endpoints may log input or output for security and product improvement. Do not use the free endpoint for confidential, private, or personal content without a separate privacy and data-processing review. Provider failures never fall back to LinguaTube's mock generator; cross-model fallback is limited to the explicitly configured OpenRouter list.

Model fallback can route around an eligible model or provider failure, but it cannot bypass an account-wide free-tier limit. OpenRouter currently documents a free-account allowance of 50 requests per day and 20 requests per minute. A `429` after that shared allowance is exhausted can affect the primary and every free fallback. Wait for the relevant limit to reset or add credits to the OpenRouter account; adding credits raises the documented daily free-model allowance, while the 20 requests-per-minute limit still applies. See OpenRouter's [pricing page](https://openrouter.ai/pricing/) and [free-tier limit guide](https://openrouter.ai/blog/tutorials/how-to-get-the-lowest-cost-llm-inference-on-openrouter/) for current limits.

The provider does not add audio recording or pronunciation assessment. Speaking practice remains self-directed: speak aloud, then type the answer for text-content feedback.

### Optional one-call smoke check

The live smoke is separate from normal tests, builds, development startup, and browser checks. It requires both an explicit flag and a key already present in the private server environment:

```bash
OPENROUTER_LIVE_SMOKE=1 npm run smoke:openrouter
```

Without both opt-ins, the test skips and makes no network request. When enabled, it performs exactly one small structured call with synthetic, non-personal text. Its output is limited to the test result and safe model/request metadata; it does not print the key, request headers, prompt, fixture text, raw response, or generated content. A `429` or `5xx` result can reflect external free-endpoint quota or availability and does not justify silently changing the configured model or weakening offline tests.

### Optional full-pipeline smoke check

The full-pipeline smoke is a separate, private operator check for the complete lesson-generation path. It uses the deterministic `MockTranscriptProvider` fixture with the real `OpenRouterProvider`; it does not fetch the referenced YouTube video's transcript. Run it only as an explicit action after the offline test suite passes:

```bash
OPENROUTER_FULL_PIPELINE_SMOKE=1 npm run smoke:openrouter:pipeline
```

The command also requires `OPENROUTER_API_KEY` to already exist in the private server environment. Do not place the key in the command, shell history, repository, or test output. With either gate missing, the test skips before constructing the provider and makes no network request.

The optional `OPENROUTER_FULL_PIPELINE_FOCUS` value may be `comprehensive`, `speaking`, `listening`, or `grammar`; omission selects `comprehensive`. An invalid value fails with a fixed configuration error before any provider call and is never echoed. For example, this selects one listening-focused run without showing a key:

```bash
OPENROUTER_FULL_PIPELINE_SMOKE=1 OPENROUTER_FULL_PIPELINE_FOCUS=listening npm run smoke:openrouter:pipeline
```

A clean run makes about eight serial logical generation calls: three vocabulary chunks, three grammar chunks, one lesson-section result, and one exercise result. Existing bounded structured-output and semantic repairs may add calls. The test runs only one focus and has an eight-minute deadline; it does not retry the whole lesson, switch models, or weaken validation when a free endpoint is unavailable.

On failure, the test writes one compact JSON array containing only allowlisted generation stage, failure kind, and sanitized schema path/code pairs, then raises a fixed generic error. It never prints the credential, environment, model output, prompt, transcript, lesson, raw provider error, request/response data, headers, identifiers, stack from the provider failure, or a Zod message. A quota, rate-limit, timeout, or upstream failure can still block the live verification independently of the offline implementation.

## Learning focus

Each video has one learning focus. New videos default to `comprehensive` (`Toàn diện`), while the create and edit forms always show and submit the selected mode explicitly.

| Value | Label | Exercises by format (multiple choice / fill blank / translation / listening / dictation) |
|---|---|---|
| `comprehensive` | Toàn diện | 10 / 8 / 8 / 8 / 8 |
| `speaking` | Luyện nói | 10 / 8 / 10 / 5 / 5 |
| `listening` | Luyện nghe | 10 / 5 / 5 / 10 / 10 |
| `grammar` | Luyện ngữ pháp | 10 / 10 / 5 / 5 / 5 |

Every mode keeps the same five exercise formats and traceability to transcript segments. Vocabulary and grammar counts depend on the available source material and the configured generation policy.

Speaking practice is self-directed: the learner speaks the answer aloud, then types it to receive text-answer feedback. LinguaTube does not record audio or automatically assess pronunciation or fluency in this MVP.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## MVP boundaries

- Video, lesson, job, cache, and progress data live in server memory. They can disappear after a process restart, hot reload, or deployment to another server instance.
- The fixed server-owned identity is `demo-user`. Authentication, authorization, and tenant isolation are required before a public production release.
- Background generation uses an in-process scheduler. A durable queue is required for serverless or multi-instance production deployment.
- Demo transcript mode makes no live YouTube transcript call. The default YouTube mode requires access to the video and a working `yt-dlp` executable; Gemini video fallback requires quota and access to the same video URL.
- Caption and model transcript quality depend on the source. The lesson records the source and time coverage; video audio playback and automatic pronunciation assessment are outside this milestone.

Never put provider credentials in `NEXT_PUBLIC_*` variables. Live provider keys must remain inside server-only provider adapters.

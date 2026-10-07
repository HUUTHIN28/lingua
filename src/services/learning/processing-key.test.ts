import { describe, expect, it } from "vitest";
import { MockAIProvider } from "@/ai/providers/mock-ai-provider";
import { OPENROUTER_STRATEGY_VERSION } from "@/ai/providers/openrouter-provider";
import { PROMPT_VERSION } from "@/ai/prompts/versions";
import { canonicalProcessingKey, hashProcessingKey, type ContentProcessingKey } from "./processing-key";

const base: ContentProcessingKey = {
  youtubeVideoId: "dQw4w9WgXcQ",
  transcriptVersion: "v1",
  learningLanguage: "en",
  nativeLanguage: "vi",
  targetLevel: "CEFR:B1",
  learningFocus: "comprehensive",
  aiProviderIdentity: "mock:linguatube-mock-v3",
  promptVersion: "p1",
};

describe("processing key", () => {
  it("is stable and changes for every processing dimension", () => {
    expect(hashProcessingKey(base)).toBe(hashProcessingKey({ ...base }));
    for (const [field, value] of [
      ["youtubeVideoId", "abcdefghijk"],
      ["transcriptVersion", "v2"],
      ["learningLanguage", "ja"],
      ["nativeLanguage", "zh"],
      ["targetLevel", "auto"],
      ["learningFocus", "listening"],
      ["aiProviderIdentity", "openrouter:model-a:json-schema-tool-fallback-v1"],
      ["promptVersion", "p2"],
    ] as const) {
      expect(hashProcessingKey({ ...base, [field]: value })).not.toBe(hashProcessingKey(base));
    }
  });

  it("serializes focus between target level and prompt version", () => {
    const canonical = JSON.parse(canonicalProcessingKey(base));
    expect(Object.keys(canonical)).toEqual([
      "youtubeVideoId",
      "transcriptVersion",
      "learningLanguage",
      "nativeLanguage",
      "targetLevel",
      "learningFocus",
      "aiProviderIdentity",
      "promptVersion",
    ]);
    const focuses = ["speaking", "listening", "grammar", "comprehensive"] as const;
    expect(new Set(focuses.map((learningFocus) => hashProcessingKey({ ...base, learningFocus }))).size).toBe(4);
  });

  it("isolates provider, model, and strategy without serializing credentials", () => {
    const identities = [
      "mock:linguatube-mock-v3",
      "openrouter:model-a:json-schema-tool-fallback-v1",
      "openrouter:model-b:json-schema-tool-fallback-v1",
      "openrouter:model-a:json-schema-tool-fallback-v2",
      "gemini:gemini-3.1-flash-lite:response-json-schema-v1",
    ];
    expect(new Set(identities.map((aiProviderIdentity) =>
      hashProcessingKey({ ...base, aiProviderIdentity }),
    )).size).toBe(identities.length);

    const canonical = canonicalProcessingKey({
      ...base,
      aiProviderIdentity: "openrouter:model-a:json-schema-tool-fallback-v1",
    });
    expect(canonical).toContain("openrouter:model-a:json-schema-tool-fallback-v1");
    expect(canonical).not.toMatch(/api.?key|authorization|bearer/i);
  });

  it("separates v11 from earlier prompts without changing provider identities", () => {
    expect(PROMPT_VERSION).toBe("linguatube-generation-v11-real-transcript");
    expect(new MockAIProvider().cacheIdentity).toBe("mock:linguatube-mock-v3");
    expect(OPENROUTER_STRATEGY_VERSION).toBe("json-schema-tool-fallback-v2");

    for (const aiProviderIdentity of [
      "mock:linguatube-mock-v3",
      `openrouter:model-a:${OPENROUTER_STRATEGY_VERSION}`,
      "gemini:gemini-3.1-flash-lite:response-json-schema-v1",
    ]) {
      const v8 = {
        ...base,
        aiProviderIdentity,
        promptVersion: "linguatube-generation-v8",
      };
      const v11 = { ...v8, promptVersion: PROMPT_VERSION };

      expect(hashProcessingKey(v11)).not.toBe(hashProcessingKey(v8));
      expect(JSON.parse(canonicalProcessingKey(v11))).toEqual({
        ...JSON.parse(canonicalProcessingKey(v8)),
        promptVersion: "linguatube-generation-v11-real-transcript",
      });
    }
  });
});

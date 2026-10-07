import { describe, expect, it } from "vitest";
import { createTranscriptTextMap, resolveExerciseSpeechText } from "./resolve-speech-text";

describe("resolveExerciseSpeechText", () => {
  const transcript = createTranscriptTextMap([
    { id: "s1", text: "First exact source sentence." },
    { id: "s2", text: "Second <source> sentence!" },
  ]);

  it("joins only public transcript text in source id order", () => {
    const expectedAnswerSentinel = "SECRET_EXPECTED_ANSWER";
    const text = resolveExerciseSpeechText(["s2", "s1"], transcript);
    expect(text).toBe("Second <source> sentence! First exact source sentence.");
    expect(text).not.toContain(expectedAnswerSentinel);
  });

  it("fails closed when any source id or text is unavailable", () => {
    expect(resolveExerciseSpeechText(["s1", "missing"], transcript)).toBeUndefined();
    expect(resolveExerciseSpeechText([], transcript)).toBeUndefined();
    expect(resolveExerciseSpeechText(["blank"], new Map([["blank", "   "]]))).toBeUndefined();
  });
});

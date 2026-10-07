import { describe, expect, it } from "vitest";
import type { GrammarPoint, VocabularyItem } from "@/domain/lesson";
import {
  assignServerOwnedChunkIds,
  mergeGrammar,
  mergeVocabulary,
} from "./merge-results";

const item = (word: string, id: string, sourceSegmentIds: string[]): VocabularyItem => ({
  id,
  word,
  meaning: "free",
  translation: "rảnh",
  exampleSentence: "Are you available?",
  exampleTranslation: "Bạn có rảnh không?",
  sourceSegmentIds,
});

const grammar = (
  title: string,
  id: string,
  sourceSegmentIds: string[],
  examples: GrammarPoint["examples"],
): GrammarPoint => ({
  id,
  title,
  explanation: `Explanation for ${title}`,
  pattern: "subject + be + adjective",
  examples,
  sourceSegmentIds,
});

describe("assignServerOwnedChunkIds", () => {
  it("assigns the exact one-based namespace and position format", () => {
    const vocabulary = assignServerOwnedChunkIds("vocabulary", 0, [
      item("available", "hostile-private-id", ["segment-1"]),
      item("practice", "hostile-private-id", ["segment-2"]),
    ]);
    const grammarItems = assignServerOwnedChunkIds("grammar", 2, [
      grammar("Be + adjective", "hostile-private-id", ["segment-3"], [{
        sentence: "Are you available?",
        translation: "Bạn có rảnh không?",
        sourceSegmentId: "segment-3",
      }]),
      grammar("Would love to", "hostile-private-id", ["segment-4"], [{
        sentence: "I would love to practice.",
        translation: "Tôi rất muốn luyện tập.",
        sourceSegmentId: "segment-4",
      }]),
    ]);

    expect(vocabulary.map(({ id }) => id)).toEqual([
      "vocabulary-chunk-1-item-1",
      "vocabulary-chunk-1-item-2",
    ]);
    expect(grammarItems.map(({ id }) => id)).toEqual([
      "grammar-chunk-3-item-1",
      "grammar-chunk-3-item-2",
    ]);
    expect(JSON.stringify([...vocabulary, ...grammarItems])).not.toContain("hostile-private-id");
  });

  it("does not mutate input and preserves every field except id", () => {
    const input = [
      {
        ...item("available", "model-id", ["segment-1", "segment-2"]),
        meaning: "free and able to do something",
        translation: "rảnh; có sẵn",
        partOfSpeech: "adjective",
        pronunciation: "/əˈveɪləbəl/",
        difficulty: { system: "CEFR" as const, value: "B1" as const },
      },
    ];
    const before = structuredClone(input);
    const assigned = assignServerOwnedChunkIds("vocabulary", 1, input);

    expect(input).toEqual(before);
    expect(assigned[0]).not.toBe(input[0]);
    expect(assigned[0]).toEqual({
      ...before[0],
      id: "vocabulary-chunk-2-item-1",
    });
    expect(assigned[0].sourceSegmentIds).not.toBe(input[0].sourceSegmentIds);
  });

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid chunk index %s",
    (chunkIndex) => {
      expect(() => assignServerOwnedChunkIds("grammar", chunkIndex, [])).toThrow(RangeError);
    },
  );

  it("is deterministic and independent of hostile duplicate raw IDs", () => {
    const input = [
      item("available", "raw-id\nprivate-output", ["segment-1"]),
      item("practice", "raw-id\nprivate-output", ["segment-2"]),
    ];
    expect(assignServerOwnedChunkIds("vocabulary", 7, input)).toEqual(
      assignServerOwnedChunkIds("vocabulary", 7, structuredClone(input)),
    );
  });
});

describe("mergeVocabulary", () => {
  it("deduplicates case-insensitively and unions traceability", () => {
    const merged = mergeVocabulary([
      [item("Available", "one", ["segment-1"])],
      [item("available", "two", ["segment-6", "segment-1"])],
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("one");
    expect(merged[0].sourceSegmentIds).toEqual(["segment-1", "segment-6"]);
  });

  it("keeps first semantic content after assignment and unions sources in order", () => {
    const first = assignServerOwnedChunkIds("vocabulary", 0, [
      { ...item("Available", "same", ["segment-1"]), meaning: "first meaning" },
    ]);
    const second = assignServerOwnedChunkIds("vocabulary", 1, [
      { ...item(" available ", "same", ["segment-6", "segment-1"]), meaning: "later meaning" },
    ]);
    const merged = mergeVocabulary([first, second]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "vocabulary-chunk-1-item-1",
      word: "Available",
      meaning: "first meaning",
      sourceSegmentIds: ["segment-1", "segment-6"],
    });
  });
});

describe("mergeGrammar", () => {
  it("keeps the first semantic record and merges source IDs and examples", () => {
    const first = assignServerOwnedChunkIds("grammar", 0, [
      grammar("Be + adjective", "duplicate-raw-id", ["segment-1"], [{
        sentence: "Are you available?",
        translation: "Bạn có rảnh không?",
        sourceSegmentId: "segment-1",
      }]),
    ]);
    const second = assignServerOwnedChunkIds("grammar", 1, [
      {
        ...grammar(" be + ADJECTIVE ", "duplicate-raw-id", ["segment-4", "segment-1"], [
          {
            sentence: "I am available.",
            translation: "Tôi rảnh.",
            sourceSegmentId: "segment-1",
          },
          {
            sentence: "The table is available.",
            translation: "Chiếc bàn còn trống.",
            sourceSegmentId: "segment-4",
          },
        ]),
        explanation: "later explanation",
      },
    ]);

    const merged = mergeGrammar([first, second]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "grammar-chunk-1-item-1",
      title: "Be + adjective",
      explanation: "Explanation for Be + adjective",
      sourceSegmentIds: ["segment-1", "segment-4"],
    });
    expect(merged[0].examples).toEqual([
      {
        sentence: "I am available.",
        translation: "Tôi rảnh.",
        sourceSegmentId: "segment-1",
      },
      {
        sentence: "The table is available.",
        translation: "Chiếc bàn còn trống.",
        sourceSegmentId: "segment-4",
      },
    ]);
  });
});

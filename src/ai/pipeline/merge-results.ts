import type { GrammarPoint, VocabularyItem } from "@/domain/lesson";

const union = (left: string[], right: string[]) => [...new Set([...left, ...right])];
const normalizedLabel = (value: string) => value
  .normalize("NFKC")
  .toLocaleLowerCase()
  .replace(/[\p{P}\p{S}]+/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

export type ChunkGeneratedKind = "vocabulary" | "grammar";

export function assignServerOwnedChunkIds<T extends { id: string }>(
  kind: ChunkGeneratedKind,
  chunkIndex: number,
  items: readonly T[],
): T[] {
  if (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0) {
    throw new RangeError("chunkIndex must be a non-negative safe integer.");
  }

  return items.map((item, itemIndex) => ({
    ...structuredClone(item),
    id: `${kind}-chunk-${chunkIndex + 1}-item-${itemIndex + 1}`,
  }));
}

export function mergeVocabulary(chunks: VocabularyItem[][]): VocabularyItem[] {
  const merged = new Map<string, VocabularyItem>();
  for (const item of chunks.flat()) {
    const key = normalizedLabel(item.word);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, structuredClone(item));
    } else {
      existing.sourceSegmentIds = union(existing.sourceSegmentIds, item.sourceSegmentIds);
    }
  }
  return [...merged.values()];
}

export function mergeGrammar(chunks: GrammarPoint[][]): GrammarPoint[] {
  const merged = new Map<string, GrammarPoint>();
  for (const item of chunks.flat()) {
    const key = normalizedLabel(item.title);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, structuredClone(item));
    } else {
      existing.sourceSegmentIds = union(existing.sourceSegmentIds, item.sourceSegmentIds);
      const examples = new Map(existing.examples.map((example) => [example.sourceSegmentId, example]));
      item.examples.forEach((example) => examples.set(example.sourceSegmentId, example));
      existing.examples = [...examples.values()];
    }
  }
  return [...merged.values()];
}

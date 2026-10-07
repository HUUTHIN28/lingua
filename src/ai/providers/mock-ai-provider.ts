import type { Exercise } from "@/domain/exercise";
import type { TranscriptSegment } from "@/domain/transcript";
import type { AIProvider, AIProviderInput, StructuredGenerationRequest } from "./ai-provider";

const short = (value: string) => value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "mock";

const exerciseFor = (
  input: Extract<AIProviderInput, { kind: "exercises" }>,
  segment: TranscriptSegment,
  index: number,
): Exercise => {
  const ordinal = index + 1;
  const common = {
    id: `temporary-${input.batch.type}-${ordinal}`,
    lessonId: input.lessonId,
    difficulty: input.targetLevel ?? { system: "CEFR" as const, value: "B1" as const },
    sourceSegmentIds: [segment.id],
  };

  switch (input.batch.type) {
    case "multiple-choice": {
      if (index === 0) {
        return {
          ...common,
          type: "multiple-choice",
          question: "What does ‘available’ mean in this conversation?",
          options: ["Busy", "Free", "Late"],
          correctAnswer: "Free",
          explanation: "Trong ngữ cảnh này, ‘available’ nghĩa là rảnh và có thể gặp mặt.",
        };
      }
      const correctAnswer = `Detail ${ordinal}`;
      return {
        ...common,
        type: "multiple-choice",
        question: `Which detail matches source sentence ${ordinal}: “${segment.text}”?`,
        options: [correctAnswer, `Distractor A ${ordinal}`, `Distractor B ${ordinal}`],
        correctAnswer,
        explanation: `Đáp án được đối chiếu với đoạn nguồn số ${ordinal}.`,
      };
    }
    case "fill-blank":
      return {
        ...common,
        type: "fill-blank",
        question: `Hoàn thành từ khóa trong câu nguồn số ${ordinal}.`,
        sentence: `Câu nguồn ${ordinal}: _____`,
        correctAnswer: segment.text,
        explanation: "Điền lại nội dung của đoạn transcript được dẫn nguồn.",
      };
    case "translation":
      return {
        ...common,
        type: "translation",
        question: input.learningFocus === "speaking"
          ? `Nói bản dịch câu số ${ordinal}, sau đó nhập lại để kiểm tra nội dung.`
          : `Dịch câu nguồn số ${ordinal} sang ngôn ngữ mẹ đẻ.`,
        sourceText: segment.text,
        sourceLanguage: input.learningLanguage,
        targetLanguage: input.nativeLanguage,
        expectedAnswer: segment.translation ?? segment.text,
        explanation: "Đối chiếu với bản dịch gắn với đoạn transcript.",
      };
    case "listening":
      const listeningFacts = [
        ["Who is being asked about tomorrow morning?", "Maya"],
        ["When is the speaker available?", "after nine"],
        ["Where will they meet?", "the cafe near the station"],
        ["What should the listener bring?", "the notes from their last lesson"],
        ["What did the speaker write down?", "several useful expressions"],
        ["Which table is mentioned?", "the table by the window"],
        ["How long was the table reserved?", "thirty minutes"],
        ["What time will they meet?", "nine thirty"],
      ] as const;
      const fact = listeningFacts[index % listeningFacts.length];
      return {
        ...common,
        type: "listening",
        question: `Nghe rồi trả lời ngắn gọn: ${fact[0]}`,
        startTimeSeconds: segment.startTimeSeconds,
        endTimeSeconds: segment.endTimeSeconds,
        expectedAnswer: fact[1],
        explanation: "Câu trả lời là một chi tiết ngắn trong đoạn nghe, không phải chép lại nguyên câu.",
      };
    case "dictation":
      return {
        ...common,
        type: "dictation",
        question: `Nghe và chép chính tả đoạn số ${ordinal}.`,
        startTimeSeconds: segment.startTimeSeconds,
        endTimeSeconds: segment.endTimeSeconds,
        expectedAnswer: segment.text,
        explanation: "So sánh phần chép với nguyên văn transcript.",
      };
  }
};

export class MockAIProvider implements AIProvider {
  readonly cacheIdentity = "mock:linguatube-mock-v3";
  readonly maxConcurrency = 32;
  invocationCount = 0;
  readonly inputs: AIProviderInput[] = [];

  async generateStructured<T>({ input }: StructuredGenerationRequest<T>): Promise<unknown> {
    this.invocationCount += 1;
    this.inputs.push(structuredClone(input));
    if (input.youtubeVideoId === "invalidjsn0") return { malformed: true };

    const seed = short(input.processingKey);
    const level = input.targetLevel ?? { system: "CEFR" as const, value: "B1" as const };
    if (input.kind === "vocabulary") {
      const result = [];
      const available = input.chunk.segments.filter((segment) =>
        segment.text.toLocaleLowerCase().includes("available"),
      );
      if (available.length > 0) {
        result.push({
          id: `vocab-available-${seed}-${input.chunk.id}`,
          word: available[0].text.includes("Available") ? "Available" : "available",
          meaning: "free and able to do something",
          translation: "rảnh; có sẵn",
          partOfSpeech: "adjective",
          exampleSentence: available[0].text,
          exampleTranslation: available[0].translation ?? "Có sẵn",
          difficulty: level,
          sourceSegmentIds: available.map((segment) => segment.id),
        });
      }
      const first = input.chunk.segments[0];
      result.push({
        id: `vocab-${seed}-${input.chunk.id}`,
        word: first.id === "segment-1" ? "tomorrow" : "practice",
        meaning: first.id === "segment-1" ? "the day after today" : "to repeat an activity to improve",
        translation: first.id === "segment-1" ? "ngày mai" : "luyện tập",
        partOfSpeech: first.id === "segment-1" ? "adverb" : "verb",
        exampleSentence: first.text,
        exampleTranslation: first.translation ?? "Ví dụ",
        difficulty: level,
        sourceSegmentIds: [first.id],
      });
      return result;
    }

    if (input.kind === "grammar") {
      const segment = input.chunk.segments[0];
      const grammarCopy = {
        speaking: ["Reusable conversation pattern", "Nhận diện dạng câu để tự tạo một lượt đáp dựa trên transcript."],
        listening: ["Grammar cues in a source utterance", "Nhận diện cấu trúc trong câu nghe gốc."],
        grammar: ["Form and use: be + adjective", "Dạng: chủ ngữ + be + tính từ; ví dụ lấy từ transcript."],
        comprehensive: ["Be + adjective", "Dùng cấu trúc này trong một tình huống hội thoại."],
      }[input.learningFocus];
      return [{
        id: `grammar-${seed}-${input.chunk.id}`,
        title: input.chunk.id.endsWith("1") ? grammarCopy[0] : `${grammarCopy[0]} · ${input.chunk.id}`,
        explanation: grammarCopy[1],
        pattern: "subject + be + adjective",
        examples: [{
          sentence: segment.text,
          translation: segment.translation ?? "Bản dịch ví dụ",
          sourceSegmentId: segment.id,
        }],
        difficulty: level,
        sourceSegmentIds: [segment.id],
      }];
    }

    if (input.kind === "sections") {
      const middle = Math.ceil(input.transcript.length / 2);
      const copy = {
        speaking: [["Conversation turns", "Luyện tạo lượt đáp từ transcript."], ["Reusable replies", "Tái sử dụng mẫu câu hội thoại."]],
        listening: [["Sound to meaning", "Liên hệ câu nghe với ý nghĩa."], ["Replay source utterances", "Nghe lại câu gốc và nhận diện chi tiết."]],
        grammar: [["Form: be + adjective", "Quan sát dạng cấu trúc trong câu."], ["Usage in context", "Phân tích cách dùng cấu trúc."]],
        comprehensive: [["Making a plan", "Hai người sắp xếp một cuộc hẹn."], ["Confirming the meeting", "Họ xác nhận chi tiết buổi gặp."]],
      }[input.learningFocus];
      return [input.transcript.slice(0, middle), input.transcript.slice(middle)].map((segments, index) => ({
        id: `section-${seed}-${index + 1}`,
        title: copy[index][0],
        summary: copy[index][1],
        startTimeSeconds: segments[0].startTimeSeconds,
        endTimeSeconds: segments.at(-1)!.endTimeSeconds,
        order: index + 1,
        sourceSegmentIds: segments.map((segment) => segment.id),
      }));
    }

    return {
      exercises: Array.from({ length: input.batch.count }, (_, index) =>
        exerciseFor(input, input.transcript[index % input.transcript.length], index)),
    };
  }
}

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VocabularyList } from "@/features/vocabulary/vocabulary-list";
import { GrammarList } from "@/features/grammar/grammar-list";

afterEach(cleanup);
const transcript = [
  { id: "segment-1", videoId: "video-1", startTimeSeconds: 5, endTimeSeconds: 10, text: "I am available.", translation: "Tôi rảnh." },
  { id: "segment-2", videoId: "video-1", startTimeSeconds: 10, endTimeSeconds: 15, text: "She is ready.", translation: "Cô ấy sẵn sàng." },
];

describe("learning content cards", () => {
  it("keeps every vocabulary learning field visible and source timestamps reachable", () => {
    render(<VocabularyList transcript={transcript} items={[{ id: "v1", word: "available", meaning: "có thời gian hoặc sẵn sàng", translation: "rảnh; có sẵn", partOfSpeech: "adjective", pronunciation: "/əˈveɪləbl/", difficulty: { system: "CEFR", value: "B1" }, exampleSentence: "I am available.", exampleTranslation: "Tôi rảnh.", sourceSegmentIds: ["segment-1"] }]} />);
    expect(screen.getByRole("heading", { name: "available" })).toBeInTheDocument();
    expect(screen.getByText("adjective")).toBeInTheDocument();
    expect(screen.getByText("/əˈveɪləbl/")).toBeInTheDocument();
    expect(screen.getByText("CEFR B1")).toBeInTheDocument();
    expect(screen.getByText("rảnh; có sẵn")).toBeInTheDocument();
    expect(screen.getByText("có thời gian hoặc sẵn sàng")).toBeInTheDocument();
    expect(screen.getByText("I am available.")).toBeInTheDocument();
    expect(screen.getByText("Tôi rảnh.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Mốc ngữ cảnh"));
    expect(screen.getByRole("link", { name: "Xem ngữ cảnh tại 0:05" })).toHaveAttribute("href", "#segment-segment-1");
  });

  it("shows grammar metadata, Vietnamese explanation, first bilingual example and secondary content", () => {
    render(<GrammarList transcript={transcript} items={[{ id: "g1", title: "Be + adjective", explanation: "Dùng động từ be trước tính từ để mô tả trạng thái.", pattern: "subject + be + adjective", difficulty: { system: "CEFR", value: "B1" }, sourceSegmentIds: ["segment-1", "segment-2"], examples: [{ sentence: "I am available.", translation: "Tôi rảnh.", sourceSegmentId: "segment-1" }, { sentence: "She is ready.", translation: "Cô ấy sẵn sàng.", sourceSegmentId: "segment-2" }] }]} />);
    expect(screen.getByRole("heading", { name: "Be + adjective" })).toBeInTheDocument();
    expect(screen.getByText("subject + be + adjective")).toBeInTheDocument();
    expect(screen.getByText("CEFR B1")).toBeInTheDocument();
    expect(screen.getByText("Dùng động từ be trước tính từ để mô tả trạng thái.")).toBeInTheDocument();
    expect(screen.getByText("I am available.")).toBeInTheDocument();
    expect(screen.getByText("Tôi rảnh.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Ví dụ khác và mốc ngữ cảnh"));
    expect(screen.getByText("She is ready.")).toBeInTheDocument();
    expect(screen.getByText("Cô ấy sẵn sàng.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem câu trong transcript tại 0:05" })).toHaveAttribute("href", "#segment-segment-1");
    expect(screen.getByRole("link", { name: "Xem câu trong transcript tại 0:10" })).toHaveAttribute("href", "#segment-segment-2");
  });

  it("never loses the translation when grammar has exactly one example", () => {
    render(<GrammarList transcript={transcript} items={[{ id: "g1", title: "Be + adjective", explanation: "Giải thích tiếng Việt", pattern: "be + adjective", difficulty: { system: "CEFR", value: "A2" }, sourceSegmentIds: ["segment-1"], examples: [{ sentence: "I am available.", translation: "Tôi rảnh.", sourceSegmentId: "segment-1" }] }]} />);
    expect(screen.getByText("Tôi rảnh.")).toBeInTheDocument();
    expect(screen.getByText("Giải thích tiếng Việt")).toBeInTheDocument();
    expect(screen.getByText("CEFR A2")).toBeInTheDocument();
    expect(screen.getByText("Mốc ngữ cảnh")).toBeInTheDocument();
    expect(screen.queryByText("Xem giải thích và ví dụ khác")).not.toBeInTheDocument();
  });
});

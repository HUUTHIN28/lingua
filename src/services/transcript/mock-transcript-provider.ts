import { ApplicationError } from "@/services/learning/errors";
import {
  MOCK_TRANSCRIPT_VERSION,
  type TranscriptProvider,
  type TranscriptRequest,
} from "./transcript-provider";

const LINES = [
  [0, 5, "Hi Maya, are you available tomorrow morning?", "Chào Maya, sáng mai bạn có rảnh không?"],
  [5, 10, "I am available after nine, and I would love to practice English.", "Mình rảnh sau chín giờ và rất muốn luyện tiếng Anh."],
  [10, 15, "Great, let us meet at the cafe near the station.", "Tuyệt, chúng ta gặp ở quán cà phê gần nhà ga nhé."],
  [15, 20, "Could you bring the notes from our last lesson?", "Bạn có thể mang ghi chú từ bài học trước không?"],
  [20, 25, "Of course. I wrote down several useful expressions.", "Tất nhiên. Mình đã ghi lại vài cách diễn đạt hữu ích."],
  [25, 30, "Is the table by the window still available?", "Chiếc bàn cạnh cửa sổ vẫn còn trống chứ?"],
  [30, 35, "Yes, I reserved it for thirty minutes.", "Có, mình đã đặt bàn trong ba mươi phút."],
  [35, 40, "Perfect, I will see you there at nine thirty.", "Hoàn hảo, mình sẽ gặp bạn ở đó lúc chín giờ ba mươi."],
] as const;

export class MockTranscriptProvider implements TranscriptProvider {
  readonly version = MOCK_TRANSCRIPT_VERSION;
  readonly sourceKind = "demo" as const;
  invocationCount = 0;

  async fetchTranscript(request: TranscriptRequest) {
    this.invocationCount += 1;
    if (request.youtubeVideoId === "transcript0") {
      throw new ApplicationError(
        "TRANSCRIPT_UNAVAILABLE",
        "Video này không có transcript khả dụng. Vui lòng thử một video khác.",
        422,
      );
    }

    const segments = LINES.map(([startTimeSeconds, endTimeSeconds, text, translation], index) => ({
      id: `segment-${index + 1}`,
      videoId: request.videoId,
      startTimeSeconds,
      endTimeSeconds,
      text,
      translation,
    }));
    return {
      segments,
      provenance: {
        kind: "demo" as const,
        sourceLanguage: request.learningLanguage,
        captionFormat: null,
        translationKind: "demo" as const,
        nativeLanguage: request.nativeLanguage,
        model: null,
        strategyVersion: this.version,
        durationSeconds: 40,
        coverage: {
          attemptedRanges: [{ startTimeSeconds: 0, endTimeSeconds: 40 }],
          firstSpeechSeconds: 0,
          lastSpeechSeconds: 40,
          method: "demo" as const,
        },
      },
    };
  }
}

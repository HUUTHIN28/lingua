import { connection } from "next/server";
import { NewVideoClient, type TranscriptMode } from "./new-video-client";

export default async function NewVideoPage() {
  await connection();
  const transcriptMode: TranscriptMode = process.env.TRANSCRIPT_PROVIDER === "mock" ? "demo" : "youtube";
  return <NewVideoClient transcriptMode={transcriptMode} />;
}

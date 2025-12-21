export type RecordingType = 'video' | 'audio';

export interface Topic {
  id: string;
  title: string;
}

export interface LocalRecording {
  id: string;
  topic: string;
  type: RecordingType;
  duration: number;
  blobId: string;
  createdAt: string;
}

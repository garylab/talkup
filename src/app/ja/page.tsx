import { HomePage } from '@/components/HomePage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TalkUp - スピーチを練習',
  description: 'ランダムなトピックでスピーチを練習しましょう',
};

export default function JaPage() {
  return <HomePage locale="ja" />;
}


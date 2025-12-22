import { HomePage } from '@/components/HomePage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TalkUp - 练习演讲',
  description: '用随机话题练习演讲',
};

export default function ZhPage() {
  return <HomePage locale="zh" />;
}


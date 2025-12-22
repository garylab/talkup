import { HomePage } from '@/components/HomePage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TalkUp - Üben Sie Ihre Rede',
  description: 'Üben Sie sprechen mit zufälligen Themen',
};

export default function DePage() {
  return <HomePage locale="de" />;
}


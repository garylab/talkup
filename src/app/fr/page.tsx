import { HomePage } from '@/components/HomePage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TalkUp - Pratiquez votre discours',
  description: 'Pratiquez parler avec des sujets aléatoires',
};

export default function FrPage() {
  return <HomePage locale="fr" />;
}


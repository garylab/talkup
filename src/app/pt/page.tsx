import { HomePage } from '@/components/HomePage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TalkUp - Pratique seu discurso',
  description: 'Pratique falar com temas aleatórios',
};

export default function PtPage() {
  return <HomePage locale="pt" />;
}


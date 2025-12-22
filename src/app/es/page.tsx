import { HomePage } from '@/components/HomePage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TalkUp - Practica tu discurso',
  description: 'Practica hablar con temas aleatorios',
};

export default function EsPage() {
  return <HomePage locale="es" />;
}


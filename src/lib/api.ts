import type { Topic } from '@/types';

class LocalApi {
  // Get a random topic from provided topics array
  async getRandomTopic(topics: string[]): Promise<Topic> {
    // Simulate slight delay
    await new Promise(resolve => setTimeout(resolve, 50));
    const randomIndex = Math.floor(Math.random() * topics.length);
    return {
      id: String(randomIndex),
      title: topics[randomIndex],
    };
  }
}

export const api = new LocalApi();

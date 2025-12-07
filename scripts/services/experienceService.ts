/* Experience data helpers */

import type { Experience } from '../../types';

const DEFAULT_ENDPOINT = './data/experiences.json';

export async function fetchExperiences(endpoint: string = DEFAULT_ENDPOINT): Promise<Experience[]> {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Failed to fetch experiences from ${endpoint}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Experiences data loading error:', error);
    return [];
  }
}

export function shuffleExperiences(experiences: Experience[]): Experience[] {
  const copy = [...experiences];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

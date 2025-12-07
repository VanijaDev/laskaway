/* Experience data helpers */
const DEFAULT_ENDPOINT = './data/experiences.json';
export async function fetchExperiences(endpoint = DEFAULT_ENDPOINT) {
    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`Failed to fetch experiences from ${endpoint}`);
        }
        return await response.json();
    }
    catch (error) {
        console.error('Experiences data loading error:', error);
        return [];
    }
}
export function shuffleExperiences(experiences) {
    const copy = [...experiences];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

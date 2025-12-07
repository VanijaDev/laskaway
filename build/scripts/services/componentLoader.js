/* Component loading helpers */
const componentCache = new Map();
async function fetchComponentMarkup(url) {
    if (!componentCache.has(url)) {
        const fetchPromise = fetch(url).then(async (response) => {
            if (!response.ok) {
                throw new Error(`Failed to load component: ${url}`);
            }
            return response.text();
        });
        componentCache.set(url, fetchPromise);
    }
    return componentCache.get(url);
}
export async function loadComponent(definition) {
    const host = document.getElementById(definition.hostId);
    if (!host) {
        console.warn(`Component host #${definition.hostId} not found in DOM.`);
        return;
    }
    try {
        const markup = await fetchComponentMarkup(definition.url);
        host.innerHTML = markup;
    }
    catch (error) {
        console.error(`Unable to render component ${definition.url}:`, error);
    }
}
export async function loadComponents(definitions) {
    await Promise.all(definitions.map(loadComponent));
}

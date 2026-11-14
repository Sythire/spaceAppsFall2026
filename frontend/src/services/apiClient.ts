const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
export const isMockMode = import.meta.env.VITE_USE_MOCKS !== 'false';
export async function apiClient<T>(path: string, body?: unknown): Promise<T> {
 if (!baseUrl) throw new Error('Set VITE_API_BASE_URL before disabling mock mode.');
 const response = await fetch(baseUrl + path, {method:body === undefined ? 'GET':'POST',headers:{'Content-Type':'application/json'},body:body === undefined ? undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if (!response.ok) throw new Error('Data service returned HTTP ' + response.status);
 return response.json() as Promise<T>;
}


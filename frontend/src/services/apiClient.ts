const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
export const isMockMode = import.meta.env.VITE_USE_MOCKS !== 'false';
export async function apiClient<T>(path: string, body?: unknown): Promise<T> {
 if (!baseUrl) throw new Error('API address is missing. Set VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1 in frontend/.env.local, then restart npm run dev.');
 const response = await fetch(baseUrl + path, {method:body === undefined ? 'GET':'POST',headers:{'Content-Type':'application/json'},body:body === undefined ? undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if (!response.ok) throw new Error('Data service returned HTTP ' + response.status);
 return response.json() as Promise<T>;
}


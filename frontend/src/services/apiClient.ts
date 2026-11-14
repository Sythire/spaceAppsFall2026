const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
export const isMockMode = import.meta.env.VITE_USE_MOCKS !== 'false';
export async function apiClient<T>(path: string, body?: unknown): Promise<T> {
 if (!baseUrl) throw new Error('API address is missing. Set VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1 in frontend/.env.local, then restart npm run dev.');
 const response = await fetch(baseUrl + path, {method:body === undefined ? 'GET':'POST',headers:{'Content-Type':'application/json'},body:body === undefined ? undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if (!response.ok) {
  const error: unknown = await response.json().catch(()=>null);
  const detail=error&&typeof error==='object'&&'detail' in error?error.detail:null;
  const message=typeof detail==='string'?detail:Array.isArray(detail)?detail.map(item=>item.msg).join('; '):'';
  throw new Error('Data service returned HTTP '+response.status+(message?': '+message:''));
 }
 return response.json() as Promise<T>;
}


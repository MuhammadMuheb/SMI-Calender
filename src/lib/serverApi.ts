import { auth } from '@/lib/firebase';
export async function serverApi<T = void>(path: string, body: unknown): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to save changes');
  return result as T;
}

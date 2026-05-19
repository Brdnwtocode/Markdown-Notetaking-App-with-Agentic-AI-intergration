export async function apiJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
  if (!res.ok) {
    // Try to parse JSON error body first
    let errorMessage = `Request failed: ${res.status}`;
    try {
      const errorBody = await res.json();
      errorMessage = errorBody.error || errorMessage;
    } catch {
      errorMessage = await res.text().catch(() => errorMessage);
    }
    throw new Error(errorMessage);
  }
  return (await res.json()) as T;
}

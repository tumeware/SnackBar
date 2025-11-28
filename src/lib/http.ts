const DEFAULT_TIMEOUT_MS = 15000;

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const excerpt = text ? ` | body: ${text.slice(0, 300)}` : "";
      throw new Error(`Request failed with ${response.status} ${response.statusText}${excerpt}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

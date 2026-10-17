export function resolveGameServerUrl(value?: string): string | undefined {
  const input = value?.trim();
  if (!input) return undefined;

  const message =
    'VITE_GAME_SERVER_URL must be an HTTP(S) server origin, such as https://your-server.onrender.com, without a path, credentials, query, or fragment.';
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(message);
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(message);
  }
  return url.origin;
}

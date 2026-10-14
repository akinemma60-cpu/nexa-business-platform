function nonEmptyString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function getSupabaseConfig({ url, publishableKey, anonKey }) {
  const projectUrl = nonEmptyString(url);
  const key = nonEmptyString(publishableKey) || nonEmptyString(anonKey);

  if (!projectUrl) return { configured: false, reason: "missing-url" };
  if (!key) return { configured: false, reason: "missing-key" };

  try {
    const parsedUrl = new URL(projectUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
      return { configured: false, reason: "invalid-url" };
    }
  } catch {
    return { configured: false, reason: "invalid-url" };
  }

  return { configured: true, reason: "", url: projectUrl, key };
}

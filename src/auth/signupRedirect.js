export function getSignupRedirectTo(configuredSiteUrl, location) {
  const localHosts = ["localhost", "127.0.0.1", "::1", "[::1]"];
  const configuredUrl = configuredSiteUrl?.trim();
  if (configuredUrl) {
    let siteUrl;
    try {
      siteUrl = new URL(configuredUrl);
    } catch {
      throw new Error("VITE_SITE_URL must be an absolute site URL, such as https://your-site.netlify.app.");
    }
    if (siteUrl.protocol !== "https:" && !(siteUrl.protocol === "http:" && localHosts.includes(siteUrl.hostname))) {
      throw new Error("VITE_SITE_URL must use HTTPS (or HTTP for local development).");
    }
    return new URL("/login", siteUrl.origin).toString();
  }

  return localHosts.includes(location.hostname) ? undefined : new URL("/login", location.origin).toString();
}

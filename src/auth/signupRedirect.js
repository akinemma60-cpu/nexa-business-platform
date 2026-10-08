export function getSignupRedirectTo(configuredSiteUrl, location) {
  const configuredUrl = configuredSiteUrl?.trim();
  if (configuredUrl) return configuredUrl;

  const localHosts = ["localhost", "127.0.0.1", "::1", "[::1]"];
  return localHosts.includes(location.hostname) ? undefined : location.origin;
}

import type { AIManifest, DiscoveryConfig } from "./types.js";

/**
 * Generate the /.well-known/ai manifest JSON.
 */
export function generateAIManifest(config: DiscoveryConfig): AIManifest {
  return { ...config.manifest };
}

/**
 * Generate JSON-LD structured data for the API.
 */
export function generateJsonLd(config: DiscoveryConfig): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebAPI",
    name: config.manifest.name,
  };

  if (config.manifest.description) {
    jsonLd["description"] = config.manifest.description;
  }

  if (config.manifest.openapi_url) {
    jsonLd["documentation"] = config.manifest.openapi_url;
  }

  if (config.manifest.contact?.url) {
    jsonLd["url"] = config.manifest.contact.url;
  }

  if (config.manifest.contact?.email) {
    jsonLd["contactPoint"] = {
      "@type": "ContactPoint",
      email: config.manifest.contact.email,
    };
  }

  if (config.manifest.capabilities && config.manifest.capabilities.length > 0) {
    jsonLd["potentialAction"] = config.manifest.capabilities.map((cap) => ({
      "@type": "Action",
      name: cap,
    }));
  }

  return jsonLd;
}

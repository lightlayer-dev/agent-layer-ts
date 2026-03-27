import {
  generateLlmsTxt,
  generateLlmsFullTxt,
  generateAIManifest,
} from "@agent-layer/core";
import type { LlmsTxtConfig, DiscoveryConfig } from "@agent-layer/core";
import {
  generateRouteMetadata,
  generateOpenAPISpec,
} from "../services/introspection.js";
import type { StrapiContentType, IntrospectionConfig } from "../services/introspection.js";

export interface StrapiInstance {
  contentTypes: Record<string, StrapiContentType>;
  config: {
    get: (key: string, defaultValue?: unknown) => unknown;
  };
}

export interface ControllerContext {
  type: string;
  body: unknown;
  set: (key: string, value: string) => void;
}

function getPluginConfig(strapi: StrapiInstance): Record<string, unknown> {
  return (strapi.config.get("plugin.agent-layer", {}) as Record<string, unknown>) ?? {};
}

function getIntrospectionConfig(pluginConfig: Record<string, unknown>): IntrospectionConfig {
  return {
    include: pluginConfig.include as string[] | undefined,
    exclude: pluginConfig.exclude as string[] | undefined,
  };
}

function getLlmsTxtConfig(pluginConfig: Record<string, unknown>): LlmsTxtConfig {
  return {
    title: (pluginConfig.title as string) ?? "API",
    description: pluginConfig.description as string | undefined,
  };
}

export const agentLayer = ({ strapi }: { strapi: StrapiInstance }) => ({
  llmsTxt(ctx: ControllerContext) {
    const pluginConfig = getPluginConfig(strapi);
    const llmsConfig = getLlmsTxtConfig(pluginConfig);
    const content = generateLlmsTxt(llmsConfig);

    ctx.type = "text/plain";
    ctx.body = content;
  },

  llmsFullTxt(ctx: ControllerContext) {
    const pluginConfig = getPluginConfig(strapi);
    const llmsConfig = getLlmsTxtConfig(pluginConfig);
    const introspectionConfig = getIntrospectionConfig(pluginConfig);
    const routes = generateRouteMetadata(strapi.contentTypes, introspectionConfig);
    const content = generateLlmsFullTxt(llmsConfig, routes);

    ctx.type = "text/plain";
    ctx.body = content;
  },

  wellKnownAi(ctx: ControllerContext) {
    const pluginConfig = getPluginConfig(strapi);
    const discoveryConfig: DiscoveryConfig = {
      manifest: {
        name: (pluginConfig.title as string) ?? "API",
        description: pluginConfig.description as string | undefined,
        openapi_url: "/agent-layer/openapi.json",
        llms_txt_url: "/agent-layer/llms.txt",
        auth: pluginConfig.auth as DiscoveryConfig["manifest"]["auth"],
        contact: pluginConfig.contact as DiscoveryConfig["manifest"]["contact"],
      },
    };

    const manifest = generateAIManifest(discoveryConfig);
    ctx.type = "application/json";
    ctx.body = manifest;
  },

  openapiJson(ctx: ControllerContext) {
    const pluginConfig = getPluginConfig(strapi);
    const introspectionConfig = getIntrospectionConfig(pluginConfig);
    const spec = generateOpenAPISpec(strapi.contentTypes, {
      title: (pluginConfig.title as string) ?? "API",
      description: pluginConfig.description as string | undefined,
      config: introspectionConfig,
    });

    ctx.type = "application/json";
    ctx.body = spec;
  },
});

export const routes = [
  {
    method: "GET",
    path: "/llms.txt",
    handler: "agentLayer.llmsTxt",
    config: {
      auth: false,
    },
  },
  {
    method: "GET",
    path: "/llms-full.txt",
    handler: "agentLayer.llmsFullTxt",
    config: {
      auth: false,
    },
  },
  {
    method: "GET",
    path: "/.well-known/ai",
    handler: "agentLayer.wellKnownAi",
    config: {
      auth: false,
    },
  },
  {
    method: "GET",
    path: "/openapi.json",
    handler: "agentLayer.openapiJson",
    config: {
      auth: false,
    },
  },
];

import { register } from "./server/register.js";
import { bootstrap } from "./server/bootstrap.js";
import { routes } from "./server/routes/index.js";
import { agentLayer } from "./server/controllers/index.js";

export default {
  register,
  bootstrap,
  routes,
  controllers: {
    agentLayer,
  },
};

// Re-export introspection utilities for advanced usage
export {
  filterContentTypes,
  generateRouteMetadata,
  generateOpenAPISpec,
} from "./server/services/introspection.js";
export type {
  StrapiAttribute,
  StrapiContentType,
  IntrospectionConfig,
  OpenAPISpec,
} from "./server/services/introspection.js";

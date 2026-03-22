/**
 * Shared middleware config for agents.txt across framework adapters.
 */
import type { AgentsTxtConfig } from "./agents-txt.js";

export interface AgentsTxtMiddlewareConfig extends AgentsTxtConfig {
  enforce?: boolean;
}

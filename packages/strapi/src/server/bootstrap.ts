/**
 * Bootstrap phase — server is ready, strapi instance is fully available.
 * Currently a no-op; introspection is done lazily on first request.
 */
export function bootstrap(): void {
  // Intentionally empty — introspection is lazy
}

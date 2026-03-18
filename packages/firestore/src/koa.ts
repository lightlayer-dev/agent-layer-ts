import type { FirestoreCollectionSchema } from "./types.js";
import { parseQueryParams, buildFirestoreQuery } from "./query.js";
import type { CompanyScopeContext } from "./query.js";

/**
 * Configuration for the Koa Firestore middleware.
 */
export interface KoaFirestoreConfig {
  /** Firestore instance (firebase-admin Firestore) */
  firestore: unknown;
  /** Declared collection schemas */
  schemas: FirestoreCollectionSchema[];
  /** Base path for routes. Default: '/api/firestore' */
  basePath?: string;
}

/**
 * Create Koa routes for Firestore collections.
 *
 * Requires `koa` and `@koa/router` to be installed.
 */
export function firestoreRoutes(config: KoaFirestoreConfig): unknown {
  // Dynamic import check — koa/router are peer dependencies
  let KoaRouter: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    KoaRouter = require("@koa/router");
  } catch {
    throw new Error(
      '@koa/router is required for Koa middleware. Install it: npm install koa @koa/router',
    );
  }

  const basePath = config.basePath || "/api/firestore";
  const router = new KoaRouter({ prefix: basePath });
  const db = config.firestore as any;

  for (const schema of config.schemas) {
    registerCollectionRoutes(router, db, schema, "");
  }

  return router;
}

function registerCollectionRoutes(
  router: any,
  db: any,
  schema: FirestoreCollectionSchema,
  parentPath: string,
): void {
  const routePath = parentPath
    ? `${parentPath}/${schema.path.replace(/\{(\w+)\}/g, ":$1")}`
    : `/${schema.path.replace(/\{(\w+)\}/g, ":$1")}`;

  // GET — list collection
  router.get(routePath, async (ctx: any) => {
    const params = parseQueryParams(ctx.query);
    const collectionRef = resolveCollectionRef(db, schema.path, ctx.params);

    const scopeCtx: CompanyScopeContext | undefined = ctx.state?.companyId
      ? { companyId: ctx.state.companyId }
      : undefined;

    const query = buildFirestoreQuery(collectionRef, params, schema, scopeCtx);
    const snapshot = await (query as any).get();

    ctx.body = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));
  });

  // GET /:id — get single document
  router.get(`${routePath}/:id`, async (ctx: any) => {
    const collectionRef = resolveCollectionRef(db, schema.path, ctx.params);
    const doc = await collectionRef.doc(ctx.params.id).get();

    if (!doc.exists) {
      ctx.status = 404;
      ctx.body = { error: "Document not found" };
      return;
    }

    ctx.body = { id: doc.id, ...doc.data() };
  });

  // POST — create document
  router.post(routePath, async (ctx: any) => {
    const collectionRef = resolveCollectionRef(db, schema.path, ctx.params);
    const data = ctx.request.body;
    const docRef = await collectionRef.add(data);
    const doc = await docRef.get();

    ctx.status = 201;
    ctx.body = { id: doc.id, ...doc.data() };
  });

  // PUT /:id — update document
  router.put(`${routePath}/:id`, async (ctx: any) => {
    const collectionRef = resolveCollectionRef(db, schema.path, ctx.params);
    const docRef = collectionRef.doc(ctx.params.id);
    const existing = await docRef.get();

    if (!existing.exists) {
      ctx.status = 404;
      ctx.body = { error: "Document not found" };
      return;
    }

    await docRef.set(ctx.request.body, { merge: true });
    const updated = await docRef.get();

    ctx.body = { id: updated.id, ...updated.data() };
  });

  // DELETE /:id — delete document
  router.delete(`${routePath}/:id`, async (ctx: any) => {
    const collectionRef = resolveCollectionRef(db, schema.path, ctx.params);
    const docRef = collectionRef.doc(ctx.params.id);
    const existing = await docRef.get();

    if (!existing.exists) {
      ctx.status = 404;
      ctx.body = { error: "Document not found" };
      return;
    }

    await docRef.delete();
    ctx.status = 204;
  });

  // Subcollections
  if (schema.subcollections) {
    for (const sub of schema.subcollections) {
      registerCollectionRoutes(router, db, sub, `${routePath}/:id`);
    }
  }
}

/**
 * Resolve a Firestore collection reference, substituting path parameters.
 * e.g. "schools/{schoolId}/shifts" with { schoolId: "abc" } → db.collection("schools").doc("abc").collection("shifts")
 */
function resolveCollectionRef(db: any, path: string, params: Record<string, string>): any {
  const segments = path.split("/");
  let ref: any = db;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const paramMatch = segment.match(/^\{(\w+)\}$/);

    if (paramMatch) {
      const paramName = paramMatch[1];
      const value = params[paramName];
      if (!value) {
        throw new Error(`Missing path parameter: ${paramName}`);
      }
      ref = ref.doc(value);
    } else {
      ref = ref.collection(segment);
    }
  }

  return ref;
}

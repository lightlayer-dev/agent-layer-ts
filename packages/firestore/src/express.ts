import type { FirestoreCollectionSchema } from "./types.js";
import { parseQueryParams, buildFirestoreQuery } from "./query.js";
import type { CompanyScopeContext } from "./query.js";

/**
 * Configuration for the Express Firestore middleware.
 */
export interface ExpressFirestoreConfig {
  /** Firestore instance (firebase-admin Firestore) */
  firestore: unknown;
  /** Declared collection schemas */
  schemas: FirestoreCollectionSchema[];
  /** Base path for routes. Default: '/api/firestore' */
  basePath?: string;
}

/**
 * Create Express routes for Firestore collections.
 *
 * Requires `express` to be installed.
 */
export function firestoreRouter(config: ExpressFirestoreConfig): unknown {
  // Dynamic import check — express is a peer dependency
  let express: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    express = require("express");
  } catch {
    throw new Error(
      'express is required for Express middleware. Install it: npm install express',
    );
  }

  const router = express.Router();
  const db = config.firestore as any;
  const basePath = config.basePath || "/api/firestore";

  for (const schema of config.schemas) {
    registerCollectionRoutes(router, db, schema, basePath, "");
  }

  return router;
}

function registerCollectionRoutes(
  router: any,
  db: any,
  schema: FirestoreCollectionSchema,
  basePath: string,
  parentPath: string,
): void {
  const routePath = parentPath
    ? `${basePath}${parentPath}/${schema.path.replace(/\{(\w+)\}/g, ":$1")}`
    : `${basePath}/${schema.path.replace(/\{(\w+)\}/g, ":$1")}`;

  // GET — list collection
  router.get(routePath, async (req: any, res: any, next: any) => {
    try {
      const params = parseQueryParams(req.query);
      const collectionRef = resolveCollectionRef(db, schema.path, req.params);

      const scopeCtx: CompanyScopeContext | undefined = req.companyId
        ? { companyId: req.companyId }
        : undefined;

      const query = buildFirestoreQuery(collectionRef, params, schema, scopeCtx);
      const snapshot = await (query as any).get();

      res.json(
        snapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data(),
        })),
      );
    } catch (err) {
      next(err);
    }
  });

  // GET /:id — get single document
  router.get(`${routePath}/:id`, async (req: any, res: any, next: any) => {
    try {
      const collectionRef = resolveCollectionRef(db, schema.path, req.params);
      const doc = await collectionRef.doc(req.params.id).get();

      if (!doc.exists) {
        res.status(404).json({ error: "Document not found" });
        return;
      }

      res.json({ id: doc.id, ...doc.data() });
    } catch (err) {
      next(err);
    }
  });

  // POST — create document
  router.post(routePath, async (req: any, res: any, next: any) => {
    try {
      const collectionRef = resolveCollectionRef(db, schema.path, req.params);
      const docRef = await collectionRef.add(req.body);
      const doc = await docRef.get();

      res.status(201).json({ id: doc.id, ...doc.data() });
    } catch (err) {
      next(err);
    }
  });

  // PUT /:id — update document
  router.put(`${routePath}/:id`, async (req: any, res: any, next: any) => {
    try {
      const collectionRef = resolveCollectionRef(db, schema.path, req.params);
      const docRef = collectionRef.doc(req.params.id);
      const existing = await docRef.get();

      if (!existing.exists) {
        res.status(404).json({ error: "Document not found" });
        return;
      }

      await docRef.set(req.body, { merge: true });
      const updated = await docRef.get();

      res.json({ id: updated.id, ...updated.data() });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:id — delete document
  router.delete(`${routePath}/:id`, async (req: any, res: any, next: any) => {
    try {
      const collectionRef = resolveCollectionRef(db, schema.path, req.params);
      const docRef = collectionRef.doc(req.params.id);
      const existing = await docRef.get();

      if (!existing.exists) {
        res.status(404).json({ error: "Document not found" });
        return;
      }

      await docRef.delete();
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Subcollections
  if (schema.subcollections) {
    for (const sub of schema.subcollections) {
      registerCollectionRoutes(router, db, sub, basePath, `${parentPath}/${schema.path.replace(/\{(\w+)\}/g, ":$1")}/:id`);
    }
  }
}

/**
 * Resolve a Firestore collection reference, substituting path parameters.
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

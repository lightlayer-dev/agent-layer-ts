import type { FirestoreCollectionSchema } from "./types.js";

export const testSchemas: FirestoreCollectionSchema[] = [
  {
    path: "threads",
    displayName: "Threads",
    description: "Chat threads between prospects and ambassadors",
    companyScopeField: "school.id",
    fields: {
      prospectName: { type: "string", required: true },
      ambassadorName: { type: "string" },
      lastMessageContent: { type: "string" },
      lastMessageTime: { type: "timestamp" },
      totalMessages: { type: "number" },
      ambassador: { type: "reference", refPath: "users" },
      prospect: { type: "reference", refPath: "users" },
      school: { type: "reference", refPath: "schools" },
      topics: { type: "array", items: { type: "string" } },
      resolved: { type: "boolean" },
    },
    subcollections: [
      {
        path: "messages",
        displayName: "Messages",
        description: "Individual messages within a thread",
        fields: {
          content: { type: "string", required: true },
          sender: { type: "reference", refPath: "users" },
          senderName: { type: "string" },
          time: { type: "timestamp", required: true },
          isNotProspect: { type: "boolean" },
        },
      },
    ],
  },
  {
    path: "schools/{schoolId}/shifts",
    displayName: "Shift Reports",
    description: "Post-shift reports filed by ambassadors",
    fields: {
      postingTitle: { type: "string" },
      ambassadorId: { type: "string" },
      visitedLocations: {
        type: "array",
        items: {
          type: "map",
          fields: {
            id: { type: "string" },
            notes: { type: "string" },
            rating: { type: "number" },
            reach: { type: "number" },
          },
        },
      },
      createdAt: { type: "timestamp" },
    },
  },
  {
    path: "schools/{schoolId}/assets",
    displayName: "Assets",
    description: "Physical assets tracked by the organization",
    fields: {
      name: { type: "string" },
      type: { type: "string" },
      status: { type: "string" },
      locationAddress: { type: "string" },
      ownerID: { type: "string" },
    },
    subcollections: [
      {
        path: "events",
        displayName: "Asset Events",
        fields: {
          type: { type: "string", required: true },
          timestamp: { type: "timestamp", required: true },
          notes: { type: "string" },
          newLocation: { type: "string" },
          newOwnerID: { type: "string" },
        },
      },
    ],
  },
];

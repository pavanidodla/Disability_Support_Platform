import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createSession = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("detectionSessions", {
      userId,
      startedAt: Date.now(),
      objectCount: 0,
      objectsDetected: [],
    });
  },
});

export const addDetection = mutation({
  args: {
    sessionId: v.id("detectionSessions"),
    label: v.string(),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) throw new Error("Invalid session");
    const existing = session.objectsDetected.find((o) => o.label === args.label);
    if (!existing) {
      await ctx.db.patch(args.sessionId, {
        objectCount: session.objectCount + 1,
        objectsDetected: [
          ...session.objectsDetected,
          { label: args.label, confidence: args.confidence, timestamp: Date.now() },
        ],
      });
    }
  },
});

export const endSession = mutation({
  args: { sessionId: v.id("detectionSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(args.sessionId, { endedAt: Date.now() });
  },
});

export const getSessions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("detectionSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const getTotalObjectsDetected = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const sessions = await ctx.db
      .query("detectionSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return sessions.reduce((sum, s) => sum + s.objectCount, 0);
  },
});

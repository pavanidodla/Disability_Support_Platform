import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createSession = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("signSessions", {
      userId,
      startedAt: Date.now(),
      signsDetected: [],
      finalSentence: "",
    });
  },
});

export const addSign = mutation({
  args: {
    sessionId: v.id("signSessions"),
    label: v.string(),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) throw new Error("Invalid session");
    await ctx.db.patch(args.sessionId, {
      signsDetected: [
        ...session.signsDetected,
        { label: args.label, confidence: args.confidence, timestamp: Date.now() },
      ],
    });
  },
});

export const endSession = mutation({
  args: {
    sessionId: v.id("signSessions"),
    finalSentence: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(args.sessionId, {
      endedAt: Date.now(),
      finalSentence: args.finalSentence,
    });
  },
});

export const getSessions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("signSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const getTotalSigns = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const sessions = await ctx.db
      .query("signSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return sessions.reduce((sum, s) => sum + s.signsDetected.length, 0);
  },
});

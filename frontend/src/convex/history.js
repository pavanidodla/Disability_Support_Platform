import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getHistory = query({
  args: {
    type: v.optional(
      v.union(
        v.literal("detection"),
        v.literal("ocr"),
        v.literal("sign_language"),
        v.literal("accessibility_scan"),
        v.literal("voice_command"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    let q = ctx.db
      .query("activityHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc");

    if (args.type) {
      q = q.filter((q) => q.eq(q.field("type"), args.type));
    }

    return await q.take(args.limit ?? 50);
  },
});

export const addActivity = mutation({
  args: {
    type: v.union(
      v.literal("detection"),
      v.literal("ocr"),
      v.literal("sign_language"),
      v.literal("accessibility_scan"),
      v.literal("voice_command"),
    ),
    title: v.string(),
    summary: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.insert("activityHistory", {
      userId,
      type: args.type,
      title: args.title,
      summary: args.summary,
      timestamp: Date.now(),
      metadata: args.metadata,
    });
  },
});

export const clearHistory = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const items = await ctx.db
      .query("activityHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const item of items) {
      await ctx.db.delete(item._id);
    }
  },
});

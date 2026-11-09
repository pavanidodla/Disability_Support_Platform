import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveDocument = mutation({
  args: {
    title: v.string(),
    extractedText: v.string(),
    sourceType: v.union(v.literal("camera"), v.literal("upload")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("ocrDocuments", {
      userId,
      title: args.title,
      extractedText: args.extractedText,
      sourceType: args.sourceType,
      createdAt: Date.now(),
    });
  },
});

export const getDocuments = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("ocrDocuments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const deleteDocument = mutation({
  args: { docId: v.id("ocrDocuments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.docId);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.docId);
  },
});

export const getTotalDocuments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const docs = await ctx.db
      .query("ocrDocuments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return docs.length;
  },
});

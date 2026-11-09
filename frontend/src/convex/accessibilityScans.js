import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveScan = mutation({
  args: {
    buildingName: v.optional(v.string()),
    location: v.optional(v.string()),
    findings: v.array(
      v.object({
        category: v.string(),
        status: v.union(v.literal("pass"), v.literal("warning"), v.literal("fail")),
        description: v.string(),
        confidence: v.number(),
      }),
    ),
    overallAssessment: v.string(),
    overallScore: v.number(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("accessibilityScans", {
      userId,
      buildingName: args.buildingName,
      location: args.location,
      createdAt: Date.now(),
      findings: args.findings,
      overallAssessment: args.overallAssessment,
      overallScore: args.overallScore,
      imageUrl: args.imageUrl,
    });
  },
});

export const getScans = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("accessibilityScans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const deleteScan = mutation({
  args: { scanId: v.id("accessibilityScans") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const scan = await ctx.db.get(args.scanId);
    if (!scan || scan.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.scanId);
  },
});

export const getTotalScans = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const scans = await ctx.db
      .query("accessibilityScans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return scans.length;
  },
});

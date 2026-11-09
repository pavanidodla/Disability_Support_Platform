import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId)
      return {
        objectsDetected: 0,
        documentsRead: 0,
        signsTranslated: 0,
        accessibilityScans: 0,
        recentActivity: [],
      };

    const [detectionSessions, ocrDocs, signSessions, scans, activity] =
      await Promise.all([
        ctx.db
          .query("detectionSessions")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("ocrDocuments")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("signSessions")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("accessibilityScans")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("activityHistory")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .take(8),
      ]);

    return {
      objectsDetected: detectionSessions.reduce(
        (sum, s) => sum + s.objectCount,
        0,
      ),
      documentsRead: ocrDocs.length,
      signsTranslated: signSessions.reduce(
        (sum, s) => sum + s.signsDetected.length,
        0,
      ),
      accessibilityScans: scans.length,
      recentActivity: activity,
      recentDocuments: ocrDocs.slice(0, 5),
      recentScans: scans.slice(0, 5),
    };
  },
});

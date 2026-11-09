import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const defaultSettings = {
  highContrast: false,
  largeText: false,
  reducedMotion: false,
  speechRate: 1.0,
  speechVolume: 1.0,
  voiceOn: true,
  detectionSensitivity: 0.5,
  confidenceThreshold: 0.6,
  cameraDeviceId: undefined ,
  dataRetentionDays: 30,
};

const defaultPreferences = {
  visualAssistance: false,
  hearingAssistance: false,
  mobilityAssistance: false,
  handsFree: false,
  generalAccessibility: false,
};

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    return user?.settings ?? defaultSettings;
  },
});

export const updateSettings = mutation({
  args: {
    settings: v.object({
      highContrast: v.boolean(),
      largeText: v.boolean(),
      reducedMotion: v.boolean(),
      speechRate: v.number(),
      speechVolume: v.number(),
      voiceOn: v.boolean(),
      detectionSensitivity: v.number(),
      confidenceThreshold: v.number(),
      cameraDeviceId: v.optional(v.string()),
      dataRetentionDays: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(userId, { settings: args.settings });
  },
});

export const getPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    return user?.accessibilityPreferences ?? defaultPreferences;
  },
});

export const updatePreferences = mutation({
  args: {
    preferences: v.object({
      visualAssistance: v.boolean(),
      hearingAssistance: v.boolean(),
      mobilityAssistance: v.boolean(),
      handsFree: v.boolean(),
      generalAccessibility: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(userId, { accessibilityPreferences: args.preferences });
  },
});

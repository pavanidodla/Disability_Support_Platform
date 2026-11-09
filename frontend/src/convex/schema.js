import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} ;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);

const schema = defineSchema(
  {
    ...authTables,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
      // AccessAI user preferences
      accessibilityPreferences: v.optional(
        v.object({
          visualAssistance: v.boolean(),
          hearingAssistance: v.boolean(),
          mobilityAssistance: v.boolean(),
          handsFree: v.boolean(),
          generalAccessibility: v.boolean(),
        }),
      ),
      // Accessibility UI settings
      settings: v.optional(
        v.object({
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
      ),
    }).index("email", ["email"]),

    // Object detection sessions
    detectionSessions: defineTable({
      userId: v.id("users"),
      startedAt: v.number(),
      endedAt: v.optional(v.number()),
      objectCount: v.number(),
      objectsDetected: v.array(
        v.object({
          label: v.string(),
          confidence: v.number(),
          timestamp: v.number(),
        }),
      ),
    }).index("by_user", ["userId"]),

    // OCR documents
    ocrDocuments: defineTable({
      userId: v.id("users"),
      title: v.string(),
      extractedText: v.string(),
      sourceType: v.union(
        v.literal("camera"),
        v.literal("upload"),
      ),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    // Sign language sessions
    signSessions: defineTable({
      userId: v.id("users"),
      startedAt: v.number(),
      endedAt: v.optional(v.number()),
      signsDetected: v.array(
        v.object({
          label: v.string(),
          confidence: v.number(),
          timestamp: v.number(),
        }),
      ),
      finalSentence: v.string(),
    }).index("by_user", ["userId"]),

    // Accessibility scans
    accessibilityScans: defineTable({
      userId: v.id("users"),
      buildingName: v.optional(v.string()),
      location: v.optional(v.string()),
      createdAt: v.number(),
      findings: v.array(
        v.object({
          category: v.string(),
          status: v.union(
            v.literal("pass"),
            v.literal("warning"),
            v.literal("fail"),
          ),
          description: v.string(),
          confidence: v.number(),
        }),
      ),
      overallAssessment: v.string(),
      overallScore: v.number(),
      imageUrl: v.optional(v.string()),
    }).index("by_user", ["userId"]),

    // Activity history
    activityHistory: defineTable({
      userId: v.id("users"),
      type: v.union(
        v.literal("detection"),
        v.literal("ocr"),
        v.literal("sign_language"),
        v.literal("accessibility_scan"),
        v.literal("voice_command"),
      ),
      title: v.string(),
      summary: v.string(),
      timestamp: v.number(),
      metadata: v.optional(v.any()),
    }).index("by_user", ["userId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;

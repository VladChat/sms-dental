import { recordAdminAuditEvent } from "../db/admin/audit";

type AdminActor = {
  userId: string;
  email: string;
  source: "allowlist" | "profile_flag";
};

// Compact, redacted audit for admin AI Knowledge saves: one event per saved
// section. Metadata carries the section key and a changed flag only — never raw
// answer text, patient data, or secrets. Audit failures never fail the request.
export async function auditAiKnowledgeSave(
  admin: AdminActor,
  clinicId: string,
  sections: string[],
): Promise<void> {
  for (const section of sections) {
    try {
      await recordAdminAuditEvent({
        adminUserId: admin.userId,
        adminEmail: admin.email,
        action: `clinic.ai_knowledge.${section}.update`,
        targetType: "clinic",
        targetId: clinicId,
        clinicId,
        metadata: { section, changed: true, authSource: admin.source },
      });
    } catch {
      // never fail the mutation on an audit hiccup
    }
  }
}

// Website scan audit: records the facts count only (no HTML, no excerpts).
export async function auditAiKnowledgeScan(
  admin: AdminActor,
  clinicId: string,
  factsFound: number,
  loaded: boolean,
): Promise<void> {
  try {
    await recordAdminAuditEvent({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: "clinic.ai_knowledge.website_scan",
      targetType: "clinic",
      targetId: clinicId,
      clinicId,
      metadata: { facts_found: factsFound, loaded, authSource: admin.source },
    });
  } catch {
    // never fail the mutation on an audit hiccup
  }
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function addAuditLog({
                                      eventType,
                                      userID,
                                      details,
                                      documentID, // optional
                                  }: {
    eventType: string;
    userID: string;
    details: string;
    documentID?: string;
}) {
    try {
        return await prisma.auditLog.create({
            data: {
                eventType,
                userID,
                details,
                documentID,
            },
        });
    } catch (error) {
        console.error("Failed to add audit log:", error);
        throw error;
    }
}
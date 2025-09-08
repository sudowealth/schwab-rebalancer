import { getDatabase } from "./db-config";
import * as schema from "../db/schema";

export async function logAudit(
	userId: string,
	action: string,
	entityType: string,
	entityId?: string,
	metadata?: unknown,
	req?: { ip?: string; ua?: string },
) {
	const db = getDatabase();
	await db.insert(schema.auditLog).values({
		id: crypto.randomUUID(),
		userId,
		action,
		entityType,
		entityId,
		metadata: metadata ? JSON.stringify(metadata) : null,
		createdAt: new Date(),
		ipAddress: req?.ip ?? null,
		userAgent: req?.ua ?? null,
	});
}



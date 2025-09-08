import { getDatabase } from "./db-config";
import { and, eq, inArray } from "drizzle-orm";
import * as schema from "../db/schema";
import type { AuthContext } from "./secure-auth";

export class SecureDB {
	private db = getDatabase();

	constructor(private authContext: AuthContext) {}

	async getUserAccounts() {
		return await this.db
			.select()
			.from(schema.account)
			.where(eq(schema.account.userId, this.authContext.userId));
	}

	async getAccountById(accountId: string) {
		const [account] = await this.db
			.select()
			.from(schema.account)
			.where(
				and(
					eq(schema.account.id, accountId),
					eq(schema.account.userId, this.authContext.userId),
				),
			)
			.limit(1);
		if (!account) {
			throw new Error("Account not found or access denied");
		}
		return account;
	}

	async updateAccount(
		accountId: string,
		updates: Partial<typeof schema.account.$inferInsert>,
	) {
		await this.getAccountById(accountId);
		return await this.db
			.update(schema.account)
			.set({ ...updates, updatedAt: Date.now() })
			.where(
				and(
					eq(schema.account.id, accountId),
					eq(schema.account.userId, this.authContext.userId),
				),
			);
	}

	async verifyAccountOwnership(accountIds: string[]): Promise<boolean> {
		const accounts = await this.db
			.select({ id: schema.account.id })
			.from(schema.account)
			.where(
				and(
					inArray(schema.account.id, accountIds),
					eq(schema.account.userId, this.authContext.userId),
				),
			);
		return accounts.length === accountIds.length;
	}
}



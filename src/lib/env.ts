import { z } from "zod";

export const EnvSchema = z.object({
	AUTH_BASE_URL: z.string().url().optional(),
	SCHWAB_CLIENT_ID: z.string().optional(),
	SCHWAB_CLIENT_SECRET: z.string().optional(),
	ALLOWED_ORIGINS: z.string().optional(),
	ENABLE_STRICT_CSP: z.string().optional(),
	NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
});

export function getEnv() {
	const parsed = EnvSchema.safeParse(process.env as unknown);
	if (!parsed.success) {
		throw new Error(
			"Invalid/missing environment configuration: " + parsed.error.message,
		);
	}
	return parsed.data as z.infer<typeof EnvSchema>;
}



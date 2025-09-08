import { ForbiddenError } from "./secure-auth";

type Key = string;
const buckets = new Map<Key, { tokens: number; updatedAt: number }>();

export function rateLimit({
	key,
	capacity,
	refillPerSec,
}: {
	key: Key;
	capacity: number;
	refillPerSec: number;
}) {
	const now = Date.now();
	const bucket = buckets.get(key) ?? { tokens: capacity, updatedAt: now };
	const elapsed = (now - bucket.updatedAt) / 1000;
	bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerSec);
	bucket.updatedAt = now;
	if (bucket.tokens < 1) return false;
	bucket.tokens -= 1;
	buckets.set(key, bucket);
	return true;
}

export function assertRateLimit(keys: string[]) {
	const ok = keys.every((k) =>
		rateLimit({ key: k, capacity: 30, refillPerSec: 0.5 })
	);
	if (!ok) throw new ForbiddenError("Rate limit exceeded");
}



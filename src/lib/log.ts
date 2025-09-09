export function safeLog(message: string, data?: Record<string, unknown>) {
  const redact = (v: unknown) => {
    if (typeof v === 'string' && /(token|secret|password|authorization)/i.test(v))
      return '[REDACTED]';
    return v;
  };
  const scrubbed = data
    ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, redact(String(v))]))
    : undefined;
  console.log(message, scrubbed ?? '');
}

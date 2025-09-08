import { createFileRoute } from "@tanstack/react-router";
import { syncYahooFundamentalsServerFn } from "../../../lib/server-functions";

export const Route = createFileRoute("/api/workers/yahoo-sync")({
  // Use a loader that runs on the server; return JSON response
  loader: async (ctx) => {
    const request = (ctx as { request?: globalThis.Request }).request;
    const url = new globalThis.URL(
      request?.url || "http://localhost/api/workers/yahoo-sync"
    );
    const providedKey =
      request?.headers.get("x-cron-key") ?? url.searchParams.get("key") ?? "";
    const expectedKey = (process.env.CRON_KEY as string | undefined) || "";

    if (!expectedKey || providedKey !== expectedKey) {
      throw new globalThis.Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        {
          status: 401,
          headers: { "content-type": "application/json" },
        }
      );
    }

    try {
      const result = await syncYahooFundamentalsServerFn({
        data: { scope: "all-securities" },
      } as unknown as Parameters<typeof syncYahooFundamentalsServerFn>[0]);

      // Throwing a Response lets us control body/headers
      throw new globalThis.Response(JSON.stringify({ success: true, result }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new globalThis.Response(
        JSON.stringify({ success: false, error: message }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        }
      );
    }
  },
  component: () => null,
});

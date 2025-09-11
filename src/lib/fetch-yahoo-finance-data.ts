import fs from 'node:fs/promises';
import path from 'node:path';
import yahooFinance from 'yahoo-finance2';

interface Security {
  ticker: string;
  name: string;
  price?: string;
  marketCap?: string;
  peRatio?: string;
  industry?: string | null;
  sector?: string | null;
}

async function getFinancialData(ticker: string) {
  try {
    // Replace dots with dashes for Yahoo Finance API (e.g., BRK.A -> BRK-A)
    const yahooTicker = ticker.replace(/\./g, '-');
    // Use yahoo-finance2's quoteSummary method to get comprehensive data
    const result = await yahooFinance.quoteSummary(yahooTicker, {
      modules: ['assetProfile', 'price', 'summaryDetail', 'defaultKeyStatistics'],
    });

    const assetProfile = result.assetProfile;
    const price = result.price;
    const summaryDetail = result.summaryDetail;
    const keyStats = result.defaultKeyStatistics;

    // Extract current price
    const currentPrice = price?.regularMarketPrice?.toFixed(2) || null;

    // Extract market cap and format it
    let marketCap = null;
    if (price?.marketCap) {
      const cap = price.marketCap;
      if (cap >= 1e12) {
        marketCap = `${(cap / 1e12).toFixed(1)}T`;
      } else if (cap >= 1e9) {
        marketCap = `${(cap / 1e9).toFixed(1)}B`;
      } else if (cap >= 1e6) {
        marketCap = `${(cap / 1e6).toFixed(1)}M`;
      } else {
        marketCap = cap.toLocaleString();
      }
    }

    // Extract PE ratio
    const peRatio =
      keyStats?.trailingEps?.toFixed(2) || summaryDetail?.trailingPE?.toFixed(2) || null;

    // Extract sector and industry
    const sector = assetProfile?.sector || null;
    const industry = assetProfile?.industry || null;

    return {
      price: currentPrice,
      marketCap,
      peRatio,
      sector,
      industry,
    };
  } catch (error) {
    console.error(
      `Error fetching data for ${ticker}:`,
      error instanceof Error ? error.message : error,
    );
    return {
      price: null,
      marketCap: null,
      peRatio: null,
      sector: null,
      industry: null,
    };
  }
}

async function main() {
  try {
    const sp500Path = path.resolve(process.cwd(), 'src', 'lib', 'sp500.json');
    const sp500Data = await fs.readFile(sp500Path, 'utf-8');
    const securities: Security[] = JSON.parse(sp500Data);

    console.log(`Total companies: ${securities.length}`);

    // Filter companies that need financial data (price, marketCap, peRatio, industry, sector)
    const companiesNeedingData = securities.filter(
      (security) =>
        !security.price ||
        !security.marketCap ||
        !security.peRatio ||
        !security.industry ||
        !security.sector,
    );

    console.log(`Companies missing financial data: ${companiesNeedingData.length}`);

    if (companiesNeedingData.length === 0) {
      console.log('✅ All companies already have financial data!');
      return;
    }

    const BATCH_SIZE = 50;
    let totalUpdated = 0;

    // Process in batches of 50
    for (let batchStart = 0; batchStart < companiesNeedingData.length; batchStart += BATCH_SIZE) {
      const batch = companiesNeedingData.slice(batchStart, batchStart + BATCH_SIZE);
      const batchNumber = Math.floor(batchStart / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(companiesNeedingData.length / BATCH_SIZE);

      console.log(
        `\n🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} companies)`,
      );

      let batchUpdated = 0;

      for (const security of batch) {
        try {
          const { price, marketCap, peRatio, sector, industry } = await getFinancialData(
            security.ticker,
          );

          // Update the security in the main array
          const securityIndex = securities.findIndex((s) => s.ticker === security.ticker);
          if (securityIndex !== -1) {
            securities[securityIndex] = {
              ...securities[securityIndex],
              price: price || securities[securityIndex].price,
              marketCap: marketCap || securities[securityIndex].marketCap,
              peRatio: peRatio || securities[securityIndex].peRatio,
              sector: sector || securities[securityIndex].sector,
              industry: industry || securities[securityIndex].industry,
            };
          }

          batchUpdated++;
          totalUpdated++;

          console.log(
            `${security.ticker} (${totalUpdated}/${companiesNeedingData.length}): $${price || 'n/a'} | ${marketCap || 'n/a'} | PE: ${peRatio || 'n/a'} | ${sector || 'n/a'} / ${industry || 'n/a'}`,
          );
        } catch (err) {
          console.error(`Failed for ${security.ticker}:`, err);
          totalUpdated++;
        }

        // Add a small delay to avoid hitting API rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Save progress after each batch
      console.log(
        `\n💾 Saving batch ${batchNumber} progress (${batchUpdated} companies updated)...`,
      );
      await fs.writeFile(sp500Path, JSON.stringify(securities, null, 2));
      console.log(`✅ Batch ${batchNumber} saved to sp500.json`);

      // Add a longer delay between batches
      if (batchStart + BATCH_SIZE < companiesNeedingData.length) {
        console.log('⏳ Waiting 2 seconds before next batch...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log(`\n🎉 All batches completed!`);
    console.log(`📊 Total companies updated: ${totalUpdated}/${companiesNeedingData.length}`);
    console.log('✅ Final SP500 data saved to sp500.json');
  } catch (error) {
    console.error('Error updating sp500.json:', error);
  }
}

main();

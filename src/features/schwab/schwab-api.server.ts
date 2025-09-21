import { and, eq } from 'drizzle-orm';
import * as schema from '~/db/schema';
import { decrypt, encrypt } from '~/lib/crypto';
import { dbProxy } from '~/lib/db-config';

// Types based on sudowealth/schwab-api structure
interface SchwabApiClient {
  trader: {
    accounts: {
      getAccountNumbers(): Promise<Array<{ accountNumber: string; hashValue: string }>>;
      getAccounts(params: { queryParams: { fields: string } }): Promise<Array<unknown>>;
      getAccountByNumber(params: {
        pathParams: { accountNumber: string };
        queryParams: { fields: string };
      }): Promise<unknown>;
    };
    userPreference: {
      getUserPreference(): Promise<unknown>;
    };
  };
  marketData: {
    quotes: {
      getQuoteBySymbolId(params: {
        pathParams: { symbol_id: string };
      }): Promise<Record<string, unknown>>;
      getQuotes(params: { queryParams: { symbols: string } }): Promise<Record<string, unknown>>;
    };
  };
}

interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

interface AuthClient {
  getAuthorizationUrl(): Promise<{ authUrl: string; generatedState?: string }>;
  exchangeCode(code: string): Promise<TokenData>;
  refresh(refreshToken: string): Promise<TokenData>;
}

// Global types for Node.js/Browser APIs
/* global URLSearchParams, fetch */

// Toggle verbose Schwab API logs (keep off in production)
const SCHWAB_DEBUG = false;

export interface SchwabAccount {
  accountNumber: string;
  accountId: string;
  type: string;
  nickName?: string;
  accountValue?: number;
}

export interface SchwabPosition {
  instrument: {
    symbol: string;
    cusip?: string;
    type?: string;
  };
  longQuantity?: number;
  shortQuantity?: number;
  settledLongQuantity?: number;
  settledShortQuantity?: number;
  agedQuantity?: number;
  averagePrice?: number;
  averageLongPrice?: number;
  averageShortPrice?: number;
  taxLotAverageLongPrice?: number;
  taxLotAverageShortPrice?: number;
  marketValue?: number;
  maintenanceRequirement?: number;
  currentDayProfitLoss?: number;
  currentDayProfitLossPercentage?: number;
  longOpenProfitLoss?: number;
  shortOpenProfitLoss?: number;
  previousSessionLongQuantity?: number;
  previousSessionShortQuantity?: number;
  currentDayCost?: number;
}

// Minimal activity/transaction types for mapping
export interface SchwabActivityItemInstrument {
  cusip?: string;
  symbol?: string;
  description?: string;
  instrumentId?: number;
  netChange?: number;
  type?: string;
}

export interface SchwabActivityTransferItem {
  instrument?: SchwabActivityItemInstrument;
  amount?: number; // quantity
  cost?: number; // total cost
  price?: number; // price per unit
  feeType?: string;
  positionEffect?: 'OPENING' | 'CLOSING' | string;
}

export interface SchwabActivity {
  activityId?: number | string;
  time?: string; // ISO
  description?: string;
  accountNumber?: string;
  type?: string; // e.g., TRADE
  status?: string; // VALID, etc
  subAccount?: string; // CASH, etc
  tradeDate?: string; // ISO
  settlementDate?: string; // ISO
  positionId?: number;
  orderId?: number;
  netAmount?: number;
  activityType?: string;
  transferItems?: SchwabActivityTransferItem[];
}

export interface SchwabCredentials {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  schwabClientId: string;
}

export class SchwabApiService {
  private schwabAuth: AuthClient | null = null;
  private apiClient: SchwabApiClient | null = null;

  constructor(
    private clientId: string,
    private clientSecret: string,
  ) {}

  private getDb() {
    return dbProxy;
  }

  private async initializeAuth(redirectUri: string): Promise<AuthClient> {
    if (!this.schwabAuth) {
      // Create a basic auth client following sudowealth patterns but using native fetch
      this.schwabAuth = {
        getAuthorizationUrl: async () => {
          const params = [
            `client_id=${encodeURIComponent(this.clientId)}`,
            `redirect_uri=${encodeURIComponent(redirectUri)}`,
            'response_type=code',
            'scope=AccountAccess+readonly',
          ].join('&');
          const authUrl = `https://api.schwabapi.com/v1/oauth/authorize?${params}`;
          return { authUrl };
        },
        exchangeCode: async (code: string): Promise<TokenData> => {
          const tokenEndpoint = 'https://api.schwabapi.com/v1/oauth/token';
          const tokenData = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri,
            client_id: this.clientId,
          });

          const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            },
            body: tokenData,
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
          }

          const tokenResponse = (await response.json()) as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
          };

          return {
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            expiresAt: Date.now() + tokenResponse.expires_in * 1000,
          };
        },
        refresh: async (refreshToken: string): Promise<TokenData> => {
          const tokenEndpoint = 'https://api.schwabapi.com/v1/oauth/token';
          const tokenData = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: this.clientId,
          });

          const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            },
            body: tokenData,
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
          }

          const tokenResponse = (await response.json()) as {
            access_token: string;
            refresh_token?: string;
            expires_in: number;
          };

          return {
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token || refreshToken,
            expiresAt: Date.now() + tokenResponse.expires_in * 1000,
          };
        },
      };
    }
    return this.schwabAuth;
  }

  private async getApiClient(userId: string): Promise<SchwabApiClient> {
    if (this.apiClient) {
      return this.apiClient;
    }

    const credentials = await this.getCredentials(userId);
    if (!credentials) {
      throw new Error('No valid Schwab credentials found');
    }

    // Create a basic API client following sudowealth patterns
    this.apiClient = {
      trader: {
        accounts: {
          getAccountNumbers: async () => {
            const response = await fetch(
              'https://api.schwabapi.com/trader/v1/accounts/accountNumbers',
              {
                headers: {
                  Authorization: `Bearer ${credentials.accessToken}`,
                  Accept: 'application/json',
                },
              },
            );
            if (!response.ok) {
              throw new Error(`API request failed: ${response.status}`);
            }
            return response.json();
          },
          getAccounts: async (params) => {
            const queryString = new URLSearchParams({
              fields: params.queryParams.fields,
            }).toString();
            const response = await fetch(
              `https://api.schwabapi.com/trader/v1/accounts?${queryString}`,
              {
                headers: {
                  Authorization: `Bearer ${credentials.accessToken}`,
                  Accept: 'application/json',
                },
              },
            );
            if (!response.ok) {
              throw new Error(`API request failed: ${response.status}`);
            }
            return response.json();
          },
          getAccountByNumber: async (params) => {
            const queryString = new URLSearchParams({
              fields: params.queryParams.fields,
            }).toString();
            const response = await fetch(
              `https://api.schwabapi.com/trader/v1/accounts/${params.pathParams.accountNumber}?${queryString}`,
              {
                headers: {
                  Authorization: `Bearer ${credentials.accessToken}`,
                  Accept: 'application/json',
                },
              },
            );
            if (!response.ok) {
              throw new Error(`API request failed: ${response.status}`);
            }
            return response.json();
          },
        },
        userPreference: {
          getUserPreference: async () => {
            const response = await fetch('https://api.schwabapi.com/trader/v1/userPreference', {
              headers: {
                Authorization: `Bearer ${credentials.accessToken}`,
                Accept: 'application/json',
              },
            });
            if (!response.ok) {
              throw new Error(`API request failed: ${response.status}`);
            }
            return response.json();
          },
        },
      },
      marketData: {
        quotes: {
          getQuoteBySymbolId: async (params) => {
            const response = await fetch(
              `https://api.schwabapi.com/marketdata/v1/quotes/${params.pathParams.symbol_id}`,
              {
                headers: {
                  Authorization: `Bearer ${credentials.accessToken}`,
                  Accept: 'application/json',
                },
              },
            );
            if (!response.ok) {
              throw new Error(`API request failed: ${response.status}`);
            }
            return response.json();
          },
          getQuotes: async (params) => {
            const response = await fetch(
              `https://api.schwabapi.com/marketdata/v1/quotes?symbols=${params.queryParams.symbols}`,
              {
                headers: {
                  Authorization: `Bearer ${credentials.accessToken}`,
                  Accept: 'application/json',
                },
              },
            );
            if (!response.ok) {
              throw new Error(`API request failed: ${response.status}`);
            }
            return response.json();
          },
        },
      },
    };

    return this.apiClient;
  }

  async getOAuthUrl(redirectUri: string): Promise<string> {
    console.log('🔐 [SchwabApi] Starting OAuth URL generation');
    console.log('🔗 [SchwabApi] Redirect URI configured');

    // Use sudowealth library for OAuth URL generation
    const auth = await this.initializeAuth(redirectUri);
    const { authUrl } = await auth.getAuthorizationUrl();
    console.log('✅ [SchwabApi] OAuth URL generated successfully');

    return authUrl;
  }

  async handleOAuthCallback(code: string, redirectUri: string, userId: string): Promise<void> {
    console.log('🔄 [SchwabApi] Starting OAuth callback handling');
    console.log('📨 [SchwabApi] Authorization code received');

    try {
      // Use our auth client for token exchange (following sudowealth patterns)
      console.log('🔐 [SchwabApi] Exchanging authorization code');
      const auth = await this.initializeAuth(redirectUri);
      const tokenData = await auth.exchangeCode(code);

      // Convert to our expected format
      const tokenResponse = {
        access_token: tokenData.accessToken,
        refresh_token: tokenData.refreshToken || '',
        expires_in: tokenData.expiresAt
          ? Math.floor((tokenData.expiresAt - Date.now()) / 1000)
          : 3600,
        refresh_token_expires_in: undefined,
      };

      console.log('✅ [SchwabApi] Token exchange successful');
      console.log('⏰ [SchwabApi] Access token expires in:', tokenResponse.expires_in, 'seconds');
      console.log(
        '⏰ [SchwabApi] Refresh token expires in:',
        tokenResponse.refresh_token_expires_in || 'NOT PROVIDED',
        'seconds',
      );

      // Schwab refresh tokens typically expire after 7 days if not specified
      const refreshTokenExpiresAt = tokenResponse.refresh_token_expires_in
        ? new Date(Date.now() + tokenResponse.refresh_token_expires_in * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days default

      console.log(
        '⏰ [SchwabApi] Using refresh token expiry:',
        refreshTokenExpiresAt.toISOString(),
      );

      await this.storeCredentials(userId, {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
        refreshTokenExpiresAt,
        schwabClientId: this.clientId,
      });

      console.log('✅ [SchwabApi] Successfully stored real Schwab credentials');
    } catch (error) {
      console.error('❌ [SchwabApi] Failed to handle OAuth callback:', error);
      throw error;
    }
  }

  private async storeCredentials(userId: string, credentials: SchwabCredentials): Promise<void> {
    console.log('💾 [SchwabApi] Starting credential storage process');
    console.log('⏰ [SchwabApi] Token expiry configured');

    try {
      console.log('🔐 [SchwabApi] Encrypting tokens and client ID...');
      const encryptedAccessToken = await encrypt(credentials.accessToken);
      const encryptedRefreshToken = await encrypt(credentials.refreshToken);
      const encryptedSchwabClientId = await encrypt(this.clientId);
      console.log('✅ [SchwabApi] Tokens and client ID encrypted successfully');

      const now = new Date();

      console.log('🔄 [SchwabApi] Deactivating existing credentials...');
      // Deactivate existing credentials
      const db = this.getDb();
      await dbProxy
        .update(schema.schwabCredentials)
        .set({ isActive: false, updatedAt: now })
        .where(
          and(
            eq(schema.schwabCredentials.userId, userId),
            eq(schema.schwabCredentials.isActive, true),
          ),
        );

      console.log('📝 [SchwabApi] Deactivated existing credentials');

      console.log('💿 [SchwabApi] Inserting new credentials...');
      // Insert new credentials
      await dbProxy.insert(schema.schwabCredentials).values({
        id: crypto.randomUUID(),
        userId,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt: new Date(credentials.tokenExpiresAt),
        refreshTokenExpiresAt: new Date(credentials.refreshTokenExpiresAt),
        encryptedSchwabClientId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      console.log('✅ [SchwabApi] Successfully stored new credentials');
    } catch (error) {
      console.error('❌ [SchwabApi] Error storing credentials:', error);
      throw error;
    }
  }

  private async getCredentials(userId: string): Promise<SchwabCredentials | null> {
    try {
      const db = this.getDb();
      const result = await dbProxy
        .select()
        .from(schema.schwabCredentials)
        .where(
          and(
            eq(schema.schwabCredentials.userId, userId),
            eq(schema.schwabCredentials.isActive, true),
          ),
        )
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const creds = result[0];

      const accessToken = await decrypt(creds.encryptedAccessToken);
      const refreshToken = await decrypt(creds.encryptedRefreshToken);
      const schwabClientId = await decrypt(creds.encryptedSchwabClientId);

      return {
        accessToken,
        refreshToken,
        tokenExpiresAt: creds.tokenExpiresAt,
        refreshTokenExpiresAt: creds.refreshTokenExpiresAt,
        schwabClientId,
      };
    } catch (error) {
      console.error('❌ [SchwabApi] Error retrieving credentials:', error);
      return null;
    }
  }

  private async refreshTokenIfNeeded(userId: string): Promise<void> {
    const credentials = await this.getCredentials(userId);
    if (!credentials) {
      throw new Error('No Schwab credentials found');
    }

    // Check if token is about to expire (within 5 minutes)
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    if (credentials.tokenExpiresAt > fiveMinutesFromNow) {
      return; // Token is still valid
    }

    // Check if refresh token is still valid
    if (credentials.refreshTokenExpiresAt <= new Date()) {
      throw new Error('Schwab refresh token has expired. User needs to re-authenticate.');
    }

    // Use our auth client for token refresh (following sudowealth patterns)
    console.log('🔄 [SchwabApi] Refreshing access token');
    try {
      const auth = await this.initializeAuth(''); // redirectUri not needed for refresh
      const newTokenData = await auth.refresh(credentials.refreshToken);

      console.log('✅ [SchwabApi] Token refresh successful');

      // Convert to our expected format
      const tokenResponse = {
        access_token: newTokenData.accessToken,
        refresh_token: newTokenData.refreshToken || credentials.refreshToken,
        expires_in: newTokenData.expiresAt
          ? Math.floor((newTokenData.expiresAt - Date.now()) / 1000)
          : 3600,
        refresh_token_expires_in: undefined,
      };

      // Schwab refresh tokens typically expire after 7 days if not specified
      const refreshTokenExpiresAt = tokenResponse.refresh_token_expires_in
        ? new Date(Date.now() + tokenResponse.refresh_token_expires_in * 1000)
        : credentials.refreshTokenExpiresAt; // Keep existing expiry if not provided

      await this.storeCredentials(userId, {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
        refreshTokenExpiresAt,
        schwabClientId: credentials.schwabClientId,
      });

      // Clear cached client to force recreation with new token
      this.apiClient = null;
    } catch (error) {
      console.error('❌ [SchwabApi] Token refresh failed:', error);
      throw new Error('Failed to refresh Schwab access token. User may need to re-authenticate.');
    }
  }

  async getAccounts(userId: string): Promise<SchwabAccount[]> {
    console.log('🏦 [SchwabApi] Fetching accounts using improved API client');

    try {
      await this.refreshTokenIfNeeded(userId);
      const schwabClient = await this.getApiClient(userId);

      console.log('📡 [SchwabApi] Calling trader.accounts.getAccountNumbers()');
      const accountNumbers = await schwabClient.trader.accounts.getAccountNumbers();
      console.log('📊 [SchwabApi] Retrieved account numbers:', accountNumbers.length);

      const accounts: SchwabAccount[] = [];

      for (const accountInfo of accountNumbers) {
        console.log('📡 [SchwabApi] Fetching account details');

        try {
          const accountDetail = await schwabClient.trader.accounts.getAccountByNumber({
            pathParams: { accountNumber: accountInfo.hashValue },
            queryParams: { fields: 'positions' },
          });
          const securitiesAccount = (
            accountDetail as {
              securitiesAccount?: {
                type?: string;
                accountNumber?: string;
                initialBalances?: { accountValue?: number };
              };
            }
          ).securitiesAccount as {
            type?: string;
            accountNumber?: string;
            initialBalances?: { accountValue?: number };
          };

          accounts.push({
            accountNumber: accountInfo.accountNumber,
            accountId: accountInfo.hashValue,
            type: securitiesAccount.type || 'CASH',
            nickName: securitiesAccount.accountNumber || accountInfo.accountNumber,
            accountValue: securitiesAccount.initialBalances?.accountValue || 0,
          });

          console.log(
            '✅ [SchwabApi] Successfully fetched account value:',
            securitiesAccount.initialBalances?.accountValue || 0,
          );
        } catch (accountError) {
          console.warn('⚠️ [SchwabApi] Failed to fetch account details:', accountError);
        }
      }

      console.log(
        '✅ [SchwabApi] Successfully fetched',
        accounts.length,
        'accounts using improved API client',
      );
      return accounts;
    } catch (error) {
      console.error('❌ [SchwabApi] Error fetching accounts:', error);
      throw error;
    }
  }

  async getPositions(userId: string, accountIdentifier: string): Promise<SchwabPosition[]> {
    console.log(
      '📊 [SchwabApi] Fetching positions using improved API client for account:',
      accountIdentifier,
    );

    try {
      await this.refreshTokenIfNeeded(userId);
      const schwabClient = await this.getApiClient(userId);

      console.log('📡 [SchwabApi] Calling trader.accounts.getAccounts() with positions field');
      const accountsData = (await schwabClient.trader.accounts.getAccounts({
        queryParams: { fields: 'positions' },
      })) as Array<{
        securitiesAccount?: {
          accountNumber?: string;
          accountId?: string;
          hashValue?: string;
          positions?: unknown[];
        };
      }>;

      console.log(
        '🔍 [SchwabApi] Accounts data structure:',
        JSON.stringify(
          accountsData.map((acc) => ({
            accountNumber: acc.securitiesAccount?.accountNumber,
            accountId: acc.securitiesAccount?.accountId,
            hashValue: acc.securitiesAccount?.hashValue,
          })),
          null,
          2,
        ),
      );

      console.log('🎯 [SchwabApi] Looking for accountIdentifier:', accountIdentifier);

      // Determine if we're looking for an account number (8 digits) or hash (64 chars)
      const isAccountNumber = /^\d{8}$/.test(accountIdentifier);
      const isHashValue = /^[A-F0-9]{64}$/.test(accountIdentifier);

      console.log('🔍 [SchwabApi] Identifier type:', {
        isAccountNumber,
        isHashValue,
        identifier: `${accountIdentifier.substring(0, 20)}...`,
      });

      // Find the specific account we want
      const positionsData = accountsData.find((account) => {
        const secAccount = account.securitiesAccount;

        if (isAccountNumber) {
          // Match by account number directly
          return secAccount?.accountNumber === accountIdentifier;
        }
        if (isHashValue) {
          // For hash values, we can only match if the API provides them (which it doesn't seem to)
          // We'll need to get account number mapping from somewhere else
          console.warn(
            '⚠️ [SchwabApi] Cannot match hash values with positions API - need account number',
          );
          return false;
        }
        // Try all possible matches as fallback
        return (
          secAccount?.hashValue === accountIdentifier ||
          secAccount?.accountId === accountIdentifier ||
          secAccount?.accountNumber === accountIdentifier
        );
      });
      if (!positionsData) {
        console.error('❌ [SchwabApi] Account not found:', accountIdentifier);
        throw new Error(`Account not found: ${accountIdentifier}`);
      }

      console.log('📊 [SchwabApi] Raw positions response:', JSON.stringify(positionsData, null, 2));

      const positions: SchwabPosition[] = [];

      if (positionsData.securitiesAccount?.positions) {
        for (const position of positionsData.securitiesAccount.positions as Array<{
          instrument: { symbol?: string; cusip?: string; type?: string };
          longQuantity?: number;
          shortQuantity?: number;
          settledLongQuantity?: number;
          settledShortQuantity?: number;
          agedQuantity?: number;
          averagePrice?: number;
          averageLongPrice?: number;
          averageShortPrice?: number;
          taxLotAverageLongPrice?: number;
          taxLotAverageShortPrice?: number;
          maintenanceRequirement?: number;
          marketValue?: number;
          currentDayProfitLoss?: number;
          currentDayProfitLossPercentage?: number;
          longOpenProfitLoss?: number;
          shortOpenProfitLoss?: number;
          previousSessionLongQuantity?: number;
          previousSessionShortQuantity?: number;
          currentDayCost?: number;
        }>) {
          const instrument = position.instrument;
          const longQuantity = position.longQuantity || 0;
          const shortQuantity = position.shortQuantity || 0;

          // Only include positions with actual holdings
          if (longQuantity > 0 || shortQuantity > 0) {
            positions.push({
              instrument: {
                symbol: instrument.symbol || 'UNKNOWN',
                cusip: instrument.cusip || '',
                type: instrument.type,
              },
              longQuantity,
              shortQuantity,
              settledLongQuantity: position.settledLongQuantity,
              settledShortQuantity: position.settledShortQuantity,
              agedQuantity: position.agedQuantity,
              averagePrice: position.averagePrice || 0,
              averageLongPrice: position.averageLongPrice,
              averageShortPrice: position.averageShortPrice,
              taxLotAverageLongPrice: position.taxLotAverageLongPrice,
              taxLotAverageShortPrice: position.taxLotAverageShortPrice,
              marketValue: position.marketValue || 0,
              maintenanceRequirement: position.maintenanceRequirement,
              currentDayProfitLoss: position.currentDayProfitLoss || 0,
              currentDayProfitLossPercentage: position.currentDayProfitLossPercentage,
              longOpenProfitLoss: position.longOpenProfitLoss,
              shortOpenProfitLoss: position.shortOpenProfitLoss,
              previousSessionLongQuantity: position.previousSessionLongQuantity,
              previousSessionShortQuantity: position.previousSessionShortQuantity,
              currentDayCost: position.currentDayCost,
            });

            console.log(
              '✅ [SchwabApi] Found position:',
              instrument.symbol,
              'quantity:',
              longQuantity,
              'value:',
              position.marketValue,
            );
          }
        }
      }

      console.log(
        '✅ [SchwabApi] Successfully fetched',
        positions.length,
        'positions using improved API client',
      );
      return positions;
    } catch (error) {
      console.error('❌ [SchwabApi] Error fetching positions:', error);
      throw error;
    }
  }

  /**
   * Fetch current cash balance for a specific account identifier (account number or hashValue).
   * Prefers currentBalances.totalCash, falling back to currentBalances.cashBalance or initialBalances.cashBalance.
   */
  async getAccountCashBalance(userId: string, accountIdentifier: string): Promise<number> {
    try {
      await this.refreshTokenIfNeeded(userId);
      const schwabClient = await this.getApiClient(userId);

      const accountsData = (await schwabClient.trader.accounts.getAccounts({
        queryParams: { fields: 'positions' },
      })) as Array<{
        securitiesAccount?: {
          accountNumber?: string;
          accountId?: string;
          hashValue?: string;
          currentBalances?: { totalCash?: number; cashBalance?: number };
          initialBalances?: { cashBalance?: number };
        };
      }>;

      const isAccountNumber = /^\d{8}$/.test(accountIdentifier);
      const isHashValue = /^[A-F0-9]{64}$/.test(accountIdentifier);

      const account = accountsData.find((a) => {
        const sa = a.securitiesAccount;
        if (isAccountNumber) return sa?.accountNumber === accountIdentifier;
        if (isHashValue)
          return sa?.hashValue === accountIdentifier || sa?.accountId === accountIdentifier;
        return (
          sa?.hashValue === accountIdentifier ||
          sa?.accountId === accountIdentifier ||
          sa?.accountNumber === accountIdentifier
        );
      });

      if (!account?.securitiesAccount) return 0;
      const current = account.securitiesAccount.currentBalances || {};
      const initial = account.securitiesAccount.initialBalances || {};
      const cash =
        (typeof current.totalCash === 'number' ? current.totalCash : undefined) ??
        (typeof current.cashBalance === 'number' ? current.cashBalance : undefined) ??
        (typeof initial.cashBalance === 'number' ? initial.cashBalance : undefined) ??
        0;
      return Number(cash) || 0;
    } catch (error) {
      console.warn('⚠️ [SchwabApi] Failed to fetch account cash balance:', error);
      return 0;
    }
  }

  async getQuote(
    userId: string,
    symbol: string,
  ): Promise<{
    lastPrice: number;
    mark: number;
    regularMarketPrice: number;
    assetMainType?: string;
    assetSubType?: string;
    description?: string;
  }> {
    const result = await this.getBulkQuotes(userId, [symbol]);
    return result[symbol];
  }

  async getBulkQuotes(
    userId: string,
    symbols: string[],
  ): Promise<
    Record<
      string,
      {
        lastPrice: number;
        mark: number;
        regularMarketPrice: number;
        assetMainType?: string;
        assetSubType?: string;
        description?: string;
      }
    >
  > {
    console.log('📈 [SchwabApi] Fetching quotes for symbols:', symbols);

    try {
      await this.refreshTokenIfNeeded(userId);
      const schwabClient = await this.getApiClient(userId);

      // Normalize symbols for Schwab (map class shares with '.' to '/' e.g., BRK.B -> BRK/B)
      const symbolMap: Record<string, string> = {};
      const apiSymbols = symbols.map((s) => {
        const normalized = s.includes('.') ? s.replace(/\./g, '/') : s;
        symbolMap[normalized] = s;
        return normalized;
      });

      const symbolsParam = apiSymbols.join(',');
      console.log(
        '📡 [SchwabApi] Calling marketData.quotes.getQuotes() with symbols:',
        symbolsParam,
      );
      const quotes = (await schwabClient.marketData.quotes.getQuotes({
        queryParams: { symbols: symbolsParam },
      })) as Record<string, unknown>;

      const result: Record<
        string,
        {
          lastPrice: number;
          mark: number;
          regularMarketPrice: number;
          assetMainType?: string;
          assetSubType?: string;
          description?: string;
        }
      > = {};

      for (const apiSymbol of apiSymbols) {
        const originalSymbol = symbolMap[apiSymbol] ?? apiSymbol;
        const quoteData = (quotes[apiSymbol] ?? quotes[originalSymbol] ?? {}) as {
          quote?: {
            lastPrice?: number;
            bidPrice?: number;
            askPrice?: number;
            mark?: number;
            regularMarketLastPrice?: number;
            closePrice?: number;
          };
          lastPrice?: number;
          bidPrice?: number;
          askPrice?: number;
          mark?: number;
          regularMarketLastPrice?: number;
          closePrice?: number;
          assetMainType?: string;
          assetSubType?: string;
          reference?: { description?: string };
        };
        if (!quoteData) {
          console.warn(
            `⚠️ [SchwabApi] No quote data found for symbol: ${originalSymbol} (api: ${apiSymbol})`,
          );
          // Skip missing symbols; caller can fall back to Yahoo
          continue;
        }

        // The quote data structure from Schwab API contains the pricing information directly
        // or in nested blocks depending on the response format
        const rawPricing = quoteData.quote || quoteData;
        const pricing: {
          lastPrice?: number;
          bidPrice?: number;
          askPrice?: number;
          mark?: number;
          regularMarketLastPrice?: number;
          closePrice?: number;
        } = {
          lastPrice: typeof rawPricing.lastPrice === 'number' ? rawPricing.lastPrice : undefined,
          bidPrice: typeof rawPricing.bidPrice === 'number' ? rawPricing.bidPrice : undefined,
          askPrice: typeof rawPricing.askPrice === 'number' ? rawPricing.askPrice : undefined,
          mark: typeof rawPricing.mark === 'number' ? rawPricing.mark : undefined,
          regularMarketLastPrice:
            typeof rawPricing.regularMarketLastPrice === 'number'
              ? rawPricing.regularMarketLastPrice
              : undefined,
          closePrice: typeof rawPricing.closePrice === 'number' ? rawPricing.closePrice : undefined,
        };

        result[originalSymbol] = {
          lastPrice: (pricing.lastPrice ?? pricing.bidPrice ?? pricing.askPrice ?? 0) || 0,
          mark:
            (pricing.mark ??
              (typeof pricing.bidPrice === 'number' && typeof pricing.askPrice === 'number'
                ? (pricing.bidPrice + pricing.askPrice) / 2
                : 0)) ||
            0,
          regularMarketPrice:
            (pricing.regularMarketLastPrice ?? pricing.closePrice ?? pricing.lastPrice ?? 0) || 0,
          assetMainType: quoteData.assetMainType,
          assetSubType: quoteData.assetSubType,
          description: quoteData.reference?.description,
        };
      }

      console.log('✅ [SchwabApi] Successfully fetched quotes:', result);
      return result;
    } catch (error) {
      console.error('❌ [SchwabApi] Error fetching quotes:', error);
      // Re-throw the error to allow price sync service to try Yahoo fallback
      throw error;
    }
  }

  async getUserPreference(userId: string): Promise<{
    accounts?: Array<{
      accountNumber?: string;
      primaryAccount?: boolean;
      type?: string;
      nickName?: string;
      accountColor?: string;
      displayAcctId?: string;
      autoPositionEffect?: boolean;
    }>;
  }> {
    console.log('🏷️ [SchwabApi] Fetching user preferences');

    try {
      await this.refreshTokenIfNeeded(userId);
      const schwabClient = await this.getApiClient(userId);

      console.log('📡 [SchwabApi] Calling trader.userPreference.getUserPreference()');
      const preferences = await schwabClient.trader.userPreference.getUserPreference();

      console.log('✅ [SchwabApi] Successfully fetched user preferences:', preferences);
      return preferences as {
        accounts?: Array<{
          accountNumber?: string;
          primaryAccount?: boolean;
          type?: string;
          nickName?: string;
          accountColor?: string;
          displayAcctId?: string;
          autoPositionEffect?: boolean;
        }>;
      };
    } catch (error) {
      console.error('❌ [SchwabApi] Error fetching user preferences:', error);
      throw error;
    }
  }

  /**
   * Preview a single-leg equity order
   */
  async previewOrder(
    userId: string,
    accountIdentifier: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      await this.refreshTokenIfNeeded(userId);
      const credentials = await this.getCredentials(userId);
      if (!credentials) throw new Error('No valid Schwab credentials found');
      const schwabClient = await this.getApiClient(userId);

      // Build a list of candidate identifiers to try (accountNumber and/or hashValue)
      const isAccountNumber = /^\d{8}$/.test(accountIdentifier);
      const isHashValue = /^[A-F0-9]{64}$/.test(accountIdentifier);

      let candidates: string[] = [accountIdentifier];
      try {
        const numberMap = (await schwabClient.trader.accounts.getAccountNumbers()) as Array<{
          accountNumber: string;
          hashValue: string;
        }>;
        const found = numberMap.find(
          (m) =>
            m.accountNumber === accountIdentifier ||
            m.hashValue?.toUpperCase() === accountIdentifier.toUpperCase(),
        );
        if (found) {
          if (isHashValue) {
            candidates = [found.accountNumber, found.hashValue];
          } else if (isAccountNumber) {
            candidates = [found.accountNumber, found.hashValue];
          } else {
            candidates = [found.accountNumber, found.hashValue];
          }
        }
      } catch (mapErr) {
        console.warn('⚠️ [SchwabApi] Could not fetch account number mapping:', mapErr);
      }

      let lastError: unknown = null;
      for (const candidate of candidates) {
        // Use correct Schwab endpoint: /previewOrder (not /orders/preview)
        const url = `https://api.schwabapi.com/trader/v1/accounts/${encodeURIComponent(
          candidate,
        )}/previewOrder`;
        if (SCHWAB_DEBUG) {
          console.log('📦 [SchwabApi] Previewing order with candidate account');
          console.log('📝 [SchwabApi] Order payload contains sensitive trading data - redacted');
        }
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          return res.json();
        }
        const text = await res.text();
        lastError = new Error(`Preview failed: ${res.status} ${text}`);
        // Continue to next candidate for 404, or for 400 with invalid account number message
        if (res.status === 404 || (res.status === 400 && /invalid account number/i.test(text))) {
          if (SCHWAB_DEBUG) {
            console.warn(
              `⚠️ [SchwabApi] Preview ${res.status} with candidate ${candidate} (${text.slice(
                0,
                120,
              )}), trying next if available`,
            );
          }
          continue;
        }
        // For other statuses, throw immediately
        throw lastError;
      }
      // Exhausted candidates
      if (lastError) throw lastError;
      throw new Error('Preview failed: No valid account identifier candidates tried');
    } catch (error) {
      console.error('❌ [SchwabApi] previewOrder error:', error);
      throw error;
    }
  }

  /**
   * Place a single-leg equity order
   */
  async placeOrder(
    userId: string,
    accountIdentifier: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      await this.refreshTokenIfNeeded(userId);
      const credentials = await this.getCredentials(userId);
      if (!credentials) throw new Error('No valid Schwab credentials found');
      const schwabClient = await this.getApiClient(userId);

      // Build candidate identifiers (accountNumber, hashValue)
      const isAccountNumber = /^\d{8}$/.test(accountIdentifier);
      const isHashValue = /^[A-F0-9]{64}$/.test(accountIdentifier);

      let candidates: string[] = [accountIdentifier];
      try {
        const numberMap = (await schwabClient.trader.accounts.getAccountNumbers()) as Array<{
          accountNumber: string;
          hashValue: string;
        }>;
        const found = numberMap.find(
          (m) =>
            m.accountNumber === accountIdentifier ||
            m.hashValue?.toUpperCase() === accountIdentifier.toUpperCase(),
        );
        if (found) {
          if (isHashValue) {
            candidates = [found.accountNumber, found.hashValue];
          } else if (isAccountNumber) {
            candidates = [found.accountNumber, found.hashValue];
          } else {
            candidates = [found.accountNumber, found.hashValue];
          }
        }
      } catch (mapErr) {
        console.warn('⚠️ [SchwabApi] Could not fetch account number mapping:', mapErr);
      }

      let lastError: unknown = null;
      for (const candidate of candidates) {
        const url = `https://api.schwabapi.com/trader/v1/accounts/${encodeURIComponent(candidate)}/orders`;
        console.log('📦 [SchwabApi] Placing order with candidate account');
        console.log('📝 [SchwabApi] Order payload contains sensitive trading data - redacted');
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        // Schwab may return 201 Created with empty body; attempt JSON but allow empty
        if (res.ok) {
          const text = await res.text();
          try {
            return text ? JSON.parse(text) : { ok: true };
          } catch {
            return { ok: true };
          }
        }
        const text = await res.text();
        lastError = new Error(`Place order failed: ${res.status} ${text}`);
        if (res.status === 404 || (res.status === 400 && /invalid account number/i.test(text))) {
          console.warn(
            `⚠️ [SchwabApi] Place ${res.status} with candidate ${candidate} (${text.slice(0, 120)}), trying next if available`,
          );
          continue;
        }
        throw lastError;
      }
      if (lastError) throw lastError;
      throw new Error('Place failed: No valid account identifier candidates tried');
    } catch (error) {
      console.error('❌ [SchwabApi] placeOrder error:', error);
      throw error;
    }
  }
  /**
   * Fetch account activities/transactions for a Schwab account number.
   * Schwab requires accountNumber (not hashValue) for this endpoint.
   */
  async getTransactions(
    userId: string,
    accountIdentifier: string,
    params: {
      startDate: Date;
      endDate: Date;
      types?: string; // default: TRADE
      symbol?: string;
    },
  ): Promise<SchwabActivity[]> {
    const { startDate, endDate, types = 'TRADE', symbol } = params;

    // Helper to ISO 8601 with milliseconds and Z
    const toIso8601 = (d: Date) => d.toISOString();

    try {
      await this.refreshTokenIfNeeded(userId);
      const credentials = await this.getCredentials(userId);
      if (!credentials) throw new Error('No valid Schwab credentials found');

      const qs = new URLSearchParams({
        startDate: toIso8601(startDate),
        endDate: toIso8601(endDate),
        types,
      });
      if (symbol) qs.set('symbol', symbol);

      // Schwab docs indicate path param is the encrypted account id (hashValue) for production.
      const url = `https://api.schwabapi.com/trader/v1/accounts/${encodeURIComponent(
        accountIdentifier,
      )}/transactions?${qs.toString()}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Transactions API failed: ${response.status} ${text}`);
      }
      const data = (await response.json()) as SchwabActivity[];
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('❌ [SchwabApi] Error fetching transactions:', error);
      throw error;
    }
  }

  async hasValidCredentials(userId: string): Promise<boolean> {
    try {
      const credentials = await this.getCredentials(userId);

      if (!credentials) {
        return false;
      }

      const now = new Date();
      const isValid = credentials.refreshTokenExpiresAt > now;

      return isValid;
    } catch (error) {
      console.error('❌ [SchwabApi] Error checking credentials:', error);
      return false;
    }
  }

  async revokeCredentials(userId: string): Promise<void> {
    const now = new Date();
    const db = await this.getDb();
    await dbProxy
      .update(schema.schwabCredentials)
      .set({ isActive: false, updatedAt: now })
      .where(
        and(
          eq(schema.schwabCredentials.userId, userId),
          eq(schema.schwabCredentials.isActive, true),
        ),
      );
  }
}

// Singleton instance
let schwabApiService: SchwabApiService | null = null;

/**
 * Check if Schwab API credentials are configured in environment variables
 * This checks for SCHWAB_CLIENT_ID and SCHWAB_CLIENT_SECRET only
 */
export function hasSchwabCredentialsConfigured(): boolean {
  const clientId = process.env.SCHWAB_CLIENT_ID;
  const clientSecret = process.env.SCHWAB_CLIENT_SECRET;

  const hasCredentials = !!(clientId && clientSecret);
  return hasCredentials;
}

export function getSchwabApiService(): SchwabApiService {
  if (!schwabApiService) {
    const clientId = process.env.SCHWAB_CLIENT_ID;
    const clientSecret = process.env.SCHWAB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        'SCHWAB_CLIENT_ID and SCHWAB_CLIENT_SECRET must be set in environment variables',
      );
    }

    schwabApiService = new SchwabApiService(clientId, clientSecret);
  }

  return schwabApiService;
}

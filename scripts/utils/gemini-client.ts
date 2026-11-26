/**
 * Gemini CLI API client
 * Fetches usage limits from Google Code Assist API
 * @handbook 7.1-common-api-pattern
 * @handbook 4.2-request-deduplication
 * @handbook 4.4-credential-caching
 * @handbook 4.7-cross-process-file-cache
 * @tested scripts/__tests__/gemini-client.test.ts
 */

import { readFile, stat } from 'fs/promises';
import { execFile } from 'child_process';
import os from 'os';
import path from 'path';
import { NEGATIVE_CACHE_SECONDS, type GeminiUsageLimits, type CacheEntry } from '../types.js';
import { hashToken } from './hash.js';
import {
  loadFileCache,
  saveFileCache,
  fileCachePath,
  STALE_CACHE_TTL_SECONDS,
} from './file-cache.js';
import { VERSION } from '../version.js';
import { debugLog } from './debug.js';

const API_TIMEOUT_MS = 5000;
const GEMINI_DIR = '.gemini';
const OAUTH_CREDS_FILE = 'oauth_creds.json';
const SETTINGS_FILE = 'settings.json';
const KEYCHAIN_SERVICE_NAME = 'gemini-cli-oauth';
const MAIN_ACCOUNT_KEY = 'main-account';

const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com';
const CODE_ASSIST_API_VERSION = 'v1internal';

// Do not refresh OAuth tokens here: Gemini CLI owns authentication. Ask the user to sign in again when needed.
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * In-memory cache for Gemini usage
 */
const geminiCacheMap: Map<string, CacheEntry<GeminiUsageLimits>> = new Map();

/**
 * Pending API requests to prevent duplicates
 */
const pendingRequests: Map<string, Promise<GeminiUsageLimits | null>> = new Map();

/**
 * Cached OAuth credentials with mtime tracking
 */
let cachedCredentials: { data: GeminiCredentials; mtime: number } | null = null;

/**
 * TTL-cached keychain result to avoid repeated execFileSync calls.
 * Shared by isGeminiInstalled() and getGeminiCredentials().
 */
let keychainCache: { data: GeminiCredentials | null; timestamp: number } | null = null;
const KEYCHAIN_CACHE_TTL_MS = 10_000;

/**
 * Cached settings with mtime tracking
 */
let cachedSettings: { data: GeminiSettings; mtime: number } | null = null;

interface GeminiCredentials {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}

interface GeminiSettings {
  cloudaicompanionProject?: string;
  selectedModel?: string;
  auth?: {
    type?: string;
  };
}

interface LoadCodeAssistResponse {
  currentTier?: {
    id: string;
    name?: string;
  } | null;
  cloudaicompanionProject?: string | null;
  ineligibleTiers?: Array<{ reasonCode?: string; tierId?: string }> | null;
}

/**
 * fetchGeminiUsage result for an account whose tier no longer serves the Gemini CLI: the
 * personal tiers were retired on 2026-06-18 (users moved to Antigravity), and loadCodeAssist
 * then answers 200 with no project and an UNSUPPORTED_CLIENT ineligible tier. Not an error:
 * widgets hide instead of showing ⚠️ for credentials left on disk.
 */
export const GEMINI_RETIRED = 'retired' as const;
const RETIRED_REASON = 'UNSUPPORTED_CLIENT';
// The verdict does not change once a tier is retired, so one check a day is enough. Not in
// CLEANABLE_PREFIXES: the hourly sweep would defeat the long TTL (same as antigravity's meta).
const RETIRED_FILE_TTL_SECONDS = 86_400;

interface BucketInfo {
  remainingAmount?: string;
  remainingFraction?: number;
  resetTime?: string;
  tokenType?: string;
  modelId?: string;
}

interface RetrieveUserQuotaResponse {
  buckets?: BucketInfo[];
}

/**
 * Get Gemini directory path
 */
function getGeminiDir(): string {
  return path.join(os.homedir(), GEMINI_DIR);
}

/**
 * Check if Gemini CLI is installed (has credentials)
 */
export async function isGeminiInstalled(): Promise<boolean> {
  try {
    // Check for keychain first
    const keychainToken = await getTokenFromKeychain();
    if (keychainToken) {
      return true;
    }

    // Fallback to file
    const oauthPath = path.join(getGeminiDir(), OAUTH_CREDS_FILE);
    await stat(oauthPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get OAuth token from macOS Keychain using security command.
 * Uses TTL-based cache and async execFile to avoid blocking the event loop.
 */
async function getTokenFromKeychain(): Promise<GeminiCredentials | null> {
  if (os.platform() !== 'darwin') {
    return null;
  }

  // Return cached result within TTL
  if (keychainCache && Date.now() - keychainCache.timestamp < KEYCHAIN_CACHE_TTL_MS) {
    return keychainCache.data;
  }

  try {
    const result = await new Promise<string>((resolve, reject) => {
      execFile(
        'security',
        ['find-generic-password', '-s', KEYCHAIN_SERVICE_NAME, '-a', MAIN_ACCOUNT_KEY, '-w'],
        { encoding: 'utf-8', timeout: 3000 },
        (error, stdout) => {
          if (error) reject(error);
          else resolve(stdout.trim());
        }
      );
    });

    if (!result) {
      keychainCache = { data: null, timestamp: Date.now() };
      return null;
    }

    // Parse the stored JSON
    const stored = JSON.parse(result);
    if (!stored.token?.accessToken) {
      keychainCache = { data: null, timestamp: Date.now() };
      return null;
    }

    const data: GeminiCredentials = {
      accessToken: stored.token.accessToken,
      refreshToken: stored.token.refreshToken,
      expiryDate: stored.token.expiresAt,
    };
    keychainCache = { data, timestamp: Date.now() };
    return data;
  } catch {
    keychainCache = { data: null, timestamp: Date.now() };
    return null;
  }
}

/**
 * Get OAuth credentials from file fallback
 */
async function getCredentialsFromFile(): Promise<GeminiCredentials | null> {
  try {
    const oauthPath = path.join(getGeminiDir(), OAUTH_CREDS_FILE);
    const fileStat = await stat(oauthPath);

    // Use cached credentials if file hasn't changed
    if (cachedCredentials && cachedCredentials.mtime === fileStat.mtimeMs) {
      return cachedCredentials.data;
    }

    const raw = await readFile(oauthPath, 'utf-8');
    const json = JSON.parse(raw);

    const accessToken = json?.access_token;
    if (!accessToken) {
      return null;
    }

    const data: GeminiCredentials = {
      accessToken,
      refreshToken: json?.refresh_token,
      expiryDate: json?.expiry_date,
    };

    cachedCredentials = { data, mtime: fileStat.mtimeMs };
    return data;
  } catch {
    return null;
  }
}

/**
 * Get Gemini OAuth credentials (Keychain first, then file fallback)
 */
async function getGeminiCredentials(): Promise<GeminiCredentials | null> {
  // Try keychain first
  const keychainCreds = await getTokenFromKeychain();
  if (keychainCreds) {
    return keychainCreds;
  }

  // Fallback to file
  return getCredentialsFromFile();
}

/**
 * Check if token needs refresh (expired or expiring soon)
 */
function tokenNeedsRefresh(credentials: GeminiCredentials): boolean {
  if (!credentials.expiryDate) {
    return false; // No expiry info, assume valid
  }
  return credentials.expiryDate < (Date.now() + TOKEN_REFRESH_BUFFER_MS);
}

/**
 * Get valid credentials, refreshing if necessary
 */
async function getValidCredentials(): Promise<GeminiCredentials | null> {
  let credentials = await getGeminiCredentials();

  if (!credentials) {
    return null;
  }

  // Gemini CLI owns token refresh. Do not send refresh tokens or embed OAuth client credentials.
  if (tokenNeedsRefresh(credentials)) {
    debugLog('gemini', 'getValidCredentials: token expired or expiring; please run Gemini CLI login again');
    return null;
  }

  return credentials;
}

/**
 * Cached project ID from loadCodeAssist API (per token hash for multi-account support).
 * Also holds a retired verdict, so a process asks once even before the file cache exists.
 */
const projectIdCacheMap: Map<string, { data: string | typeof GEMINI_RETIRED; timestamp: number }> = new Map();
const PROJECT_ID_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get Gemini settings from ~/.gemini/settings.json
 */
async function getGeminiSettings(): Promise<GeminiSettings | null> {
  try {
    const settingsPath = path.join(getGeminiDir(), SETTINGS_FILE);
    const fileStat = await stat(settingsPath);

    // Use cached settings if file hasn't changed
    if (cachedSettings && cachedSettings.mtime === fileStat.mtimeMs) {
      return cachedSettings.data;
    }

    const raw = await readFile(settingsPath, 'utf-8');
    const json = JSON.parse(raw);

    const data: GeminiSettings = {
      cloudaicompanionProject: json?.cloudaicompanionProject,
      selectedModel: json?.selectedModel || json?.model?.name,
      auth: json?.auth,
    };

    cachedSettings = { data, mtime: fileStat.mtimeMs };
    return data;
  } catch {
    return null;
  }
}

/**
 * Get current Gemini model from settings
 */
export async function getGeminiModel(): Promise<string | null> {
  const settings = await getGeminiSettings();
  return settings?.selectedModel ?? null;
}

/**
 * Get project ID via loadCodeAssist API
 * Falls back to environment variable or settings
 */
async function getProjectId(credentials: GeminiCredentials): Promise<string | typeof GEMINI_RETIRED | null> {
  // Check environment variable first
  const envProjectId = process.env['GOOGLE_CLOUD_PROJECT'] || process.env['GOOGLE_CLOUD_PROJECT_ID'];
  if (envProjectId) {
    return envProjectId;
  }

  // Check settings file
  const settings = await getGeminiSettings();
  if (settings?.cloudaicompanionProject) {
    return settings.cloudaicompanionProject;
  }

  // Use token hash for cache key (multi-account support)
  const tokenHash = hashToken(credentials.accessToken);

  // Check cache
  const cached = projectIdCacheMap.get(tokenHash);
  if (cached && (Date.now() - cached.timestamp) < PROJECT_ID_CACHE_TTL_MS) {
    return cached.data;
  }

  // Fetch from loadCodeAssist API
  try {
    const url = `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:loadCodeAssist`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': `agent-dashboard/${VERSION}`,
        'Authorization': `Bearer ${credentials.accessToken}`,
      },
      body: JSON.stringify({
        metadata: {
          ideType: 'GEMINI_CLI',
          platform: 'PLATFORM_UNSPECIFIED',
          pluginType: 'GEMINI',
        },
      }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (!response.ok) {
      debugLog('gemini', 'loadCodeAssist: response not ok', response.status);
      return null;
    }

    const data = await response.json() as LoadCodeAssistResponse;
    const projectId = data?.cloudaicompanionProject;

    if (projectId) {
      projectIdCacheMap.set(tokenHash, { data: projectId, timestamp: Date.now() });
      return projectId;
    }
    if (!data?.currentTier && data?.ineligibleTiers?.some((tier) => tier.reasonCode === RETIRED_REASON)) {
      debugLog('gemini', 'loadCodeAssist: account tier retired for this client');
      projectIdCacheMap.set(tokenHash, { data: GEMINI_RETIRED, timestamp: Date.now() });
      return GEMINI_RETIRED;
    }
  } catch (err) {
    debugLog('gemini', 'loadCodeAssist error:', err);
  }

  return null;
}

/**
 * Fetch Gemini usage limits
 */
export async function fetchGeminiUsage(
  ttlSeconds: number = 60
): Promise<GeminiUsageLimits | typeof GEMINI_RETIRED | null> {
  const credentials = await getValidCredentials();
  if (!credentials) {
    debugLog('gemini', 'fetchGeminiUsage: no valid credentials');
    return null;
  }

  // Keyed by the refresh token: the access token rotates hourly, the account does not.
  const tierFile = fileCachePath(`gemini-tier-${hashToken(credentials.refreshToken ?? credentials.accessToken)}.json`);
  if ((await loadFileCache<{ retired?: boolean }>(tierFile, RETIRED_FILE_TTL_SECONDS))?.data?.retired === true) {
    return GEMINI_RETIRED;
  }

  const projectId = await getProjectId(credentials);
  if (projectId === GEMINI_RETIRED) {
    await saveFileCache(tierFile, { retired: true });
    return GEMINI_RETIRED;
  }
  if (!projectId) {
    debugLog('gemini', 'fetchGeminiUsage: no project ID found');
    return null;
  }

  const tokenHash = hashToken(credentials.accessToken);
  const cacheFile = fileCachePath(`gemini-usage-${tokenHash}.json`);

  // Check memory cache (includes negative cache entries)
  const cached = geminiCacheMap.get(tokenHash);
  if (cached) {
    const ageSeconds = (Date.now() - cached.timestamp) / 1000;
    const effectiveTtl = cached.isError ? NEGATIVE_CACHE_SECONDS : ttlSeconds;
    if (ageSeconds < effectiveTtl) {
      if (cached.isError) {
        debugLog('gemini', 'Negative cache hit, skipping API call');
        return null;
      }
      debugLog('gemini', 'fetchGeminiUsage: returning cached data');
      return cached.data;
    }
  }

  // Check file cache (shared across processes — narrows multi-session stampede)
  const fromFile = await loadFileCache<GeminiUsageLimits>(cacheFile, ttlSeconds);
  if (fromFile) {
    debugLog('gemini', 'file cache hit');
    geminiCacheMap.set(tokenHash, { data: fromFile.data, timestamp: fromFile.timestamp });
    return fromFile.data;
  }

  // Check pending request
  const pending = pendingRequests.get(tokenHash);
  if (pending) {
    return pending;
  }

  // Create new request
  const requestPromise = fetchFromGeminiApi(credentials, projectId);
  pendingRequests.set(tokenHash, requestPromise);

  try {
    const result = await requestPromise;
    if (result) {
      await saveFileCache(cacheFile, result);
      return result;
    }

    // API failed - set negative cache to prevent rapid retries
    debugLog('gemini', `Setting negative cache for ${NEGATIVE_CACHE_SECONDS}s`);
    geminiCacheMap.set(tokenHash, {
      data: null,
      timestamp: Date.now(),
      isError: true,
    });

    // Fall back to stale cache
    if (cached && !cached.isError) {
      debugLog('gemini', 'Returning stale cache data');
      return cached.data;
    }

    // Stale file cache as last resort
    const staleFile = await loadFileCache<GeminiUsageLimits>(cacheFile, STALE_CACHE_TTL_SECONDS);
    if (staleFile) {
      debugLog('gemini', 'stale file cache fallback');
      return staleFile.data;
    }

    return null;
  } finally {
    pendingRequests.delete(tokenHash);
  }
}

/**
 * Internal API fetch
 */
async function fetchFromGeminiApi(
  credentials: GeminiCredentials,
  projectId: string
): Promise<GeminiUsageLimits | null> {
  try {
    debugLog('gemini', 'fetchFromGeminiApi: starting...');

    const url = `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:retrieveUserQuota`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': `agent-dashboard/${VERSION}`,
        'Authorization': `Bearer ${credentials.accessToken}`,
      },
      body: JSON.stringify({
        project: projectId,
      }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    debugLog('gemini', 'fetchFromGeminiApi: response status', response.status);

    if (!response.ok) {
      debugLog('gemini', 'fetchFromGeminiApi: response not ok');
      return null;
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      debugLog('gemini', 'fetchFromGeminiApi: invalid JSON response');
      return null;
    }

    // Validate response structure
    if (!data || typeof data !== 'object') {
      debugLog('gemini', 'fetchFromGeminiApi: invalid response - not an object');
      return null;
    }

    const typedData = data as RetrieveUserQuotaResponse;
    debugLog('gemini', `fetchFromGeminiApi: got data ${typedData.buckets?.length || 0} buckets`);

    const model = await getGeminiModel();

    // Process buckets - find current model and aggregate
    let primaryBucket: BucketInfo | null = null;
    let currentModelBucket: BucketInfo | null = null;

    if (typedData.buckets && Array.isArray(typedData.buckets)) {
      for (const bucket of typedData.buckets) {
        // Find bucket for current model
        if (model && bucket.modelId && bucket.modelId.includes(model)) {
          currentModelBucket = bucket;
        }
        // Use first bucket as primary if no model match
        if (!primaryBucket) {
          primaryBucket = bucket;
        }
      }
    }

    // Use current model bucket if found, otherwise primary
    const activeBucket = currentModelBucket || primaryBucket;

    // Use settings model, or fall back to first bucket's model
    const displayModel = model ?? activeBucket?.modelId ?? 'unknown';

    const limits: GeminiUsageLimits = {
      model: displayModel,
      // remainingFraction is remaining, so usage = 1 - remaining
      usedPercent: activeBucket?.remainingFraction !== undefined
        ? Math.round((1 - activeBucket.remainingFraction) * 100)
        : null,
      resetAt: activeBucket?.resetTime ?? null,
      buckets: typedData.buckets?.map(b => ({
        modelId: b.modelId,
        usedPercent: b.remainingFraction !== undefined
          ? Math.round((1 - b.remainingFraction) * 100)
          : null,
        resetAt: b.resetTime ?? null,
      })) ?? [],
    };

    // Update cache
    const tokenHash = hashToken(credentials.accessToken);
    geminiCacheMap.set(tokenHash, { data: limits, timestamp: Date.now() });
    debugLog('gemini', 'fetchFromGeminiApi: success', limits);

    return limits;
  } catch (err) {
    debugLog('gemini', 'fetchFromGeminiApi: error', err);
    return null;
  }
}

/**
 * Clear cache (for testing)
 */
export function clearGeminiCache(): void {
  geminiCacheMap.clear();
  projectIdCacheMap.clear();
  cachedCredentials = null;
  cachedSettings = null;
  keychainCache = null;
}

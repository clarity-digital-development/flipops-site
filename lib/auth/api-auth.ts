import { NextRequest, NextResponse } from 'next/server';

/**
 * API Key validation for external services
 */

// Store API keys - in production, these should be in a database
const VALID_API_KEYS = new Set([
  process.env.FLIPOPS_API_KEY,
  process.env.FO_API_KEY,
  // Add more API keys as needed
].filter(Boolean));

export interface ApiAuthResult {
  isValid: boolean;
  error?: string;
  apiKeyId?: string;
}

/**
 * Validates API key from request headers
 */
export function validateApiKey(request: NextRequest): ApiAuthResult {
  // Check for API key in different header formats
  const authHeader = request.headers.get('Authorization');
  const apiKeyHeader = request.headers.get('X-API-Key');
  const foApiKey = request.headers.get('X-FO-API-Key');

  let apiKey: string | null = null;

  // Extract API key from Authorization Bearer header
  if (authHeader?.startsWith('Bearer ')) {
    apiKey = authHeader.substring(7);
  } else if (apiKeyHeader) {
    apiKey = apiKeyHeader;
  } else if (foApiKey) {
    apiKey = foApiKey;
  }

  // No API key provided
  if (!apiKey) {
    return {
      isValid: false,
      error: 'API key required. Provide via Authorization: Bearer {key} or X-API-Key header',
    };
  }

  // Validate API key
  if (!VALID_API_KEYS.has(apiKey)) {
    return {
      isValid: false,
      error: 'Invalid API key',
    };
  }

  // API key is valid
  return {
    isValid: true,
    apiKeyId: apiKey.substring(0, 10) + '...', // For logging
  };
}

/**
 * Middleware to protect API routes
 */
export async function withApiAuth(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const authResult = validateApiKey(request);

  if (!authResult.isValid) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    );
  }

  // Add API key ID to request for logging
  const modifiedHeaders = new Headers(request.headers);
  modifiedHeaders.set('X-API-Key-ID', authResult.apiKeyId || '');

  // Create new request with modified headers
  const modifiedRequest = new NextRequest(request.url, {
    method: request.method,
    headers: modifiedHeaders,
    body: request.body,
  });

  return handler(modifiedRequest);
}

/**
 * Rate limiting for API endpoints
 */
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT = 100; // requests per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute in ms

export function checkRateLimit(apiKeyId: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(apiKeyId);

  if (!record || now - record.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(apiKeyId, { count: 1, timestamp: now });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}
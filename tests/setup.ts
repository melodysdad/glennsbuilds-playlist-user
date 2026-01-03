/**
 * Test setup file
 * Runs before all tests
 */

import { beforeEach, afterAll, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

// Set up environment variables
process.env.PLAYLISTS_TABLE = 'test-playlists';
process.env.USER_PROFILES_TABLE = 'test-user-profiles';
process.env.SUPPRESSIONS_TABLE = 'test-suppressions';
process.env.SERVICE_CREDENTIALS_TABLE = 'test-service-credentials';
process.env.PLAYLIST_SERVICE_PREVIEW_FUNCTION = 'test-preview-function';
process.env.PLAYLIST_SERVICE_COMPLETE_FUNCTION = 'test-complete-function';
process.env.PLAYLIST_SERVICE_GET_FUNCTION = 'test-get-function';
process.env.AWS_REGION = 'us-east-1';

export const TEST_DATA_DIR = path.join(process.cwd(), 'data-test');

// 1. Create Spies
// We use mockImplementation to still call the original console but track it,
// or you can leave it empty to keep your test output clean.
const errorSpy = vi.spyOn(console, 'error');
const warnSpy = vi.spyOn(console, 'warn');

beforeEach(async () => {
  try {
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  } catch { /* ignore */ }

  // 2. Clear history between tests
  errorSpy.mockClear();
  warnSpy.mockClear();
});

afterEach(() => {
  // 3. Type-safe access to calls
  const unexpectedErrors = errorSpy.mock.calls.filter((args) => {
    // args is typed as any[] by Vitest spies, avoiding the 'unknown' error
    const message = args.map(arg => String(arg)).join(' ');

    const expectedPatterns = [
      'Lambda error:', 'request received:', 'Preferences updated',
      'Suppression added', 'Preview request', 'Preview received',
      'Complete request', 'Generation started', 'Get playlist',
      'Playlist status', 'Generate playlist', 'Draft playlist',
      'Invoking playlist service', 'Invoking complete service',
      'Invoking get playlist service', 'Lambda response metadata',
      'Lambda error payload', 'Playlist preview generated',
      'Complete request submitted', 'Playlist retrieved',
      'Error generating preview', 'at Module.handler', 'at file:///'
    ];

    return !expectedPatterns.some(pattern => message.includes(pattern));
  });

  if (unexpectedErrors.length > 0) {
    throw new Error(
      `Test produced unexpected console errors:\n${JSON.stringify(unexpectedErrors, null, 2)}`
    );
  }
});

afterAll(async () => {
  try {
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  } catch { /* ignore */ }

  // 4. Fully restore console to original state
  vi.restoreAllMocks();
});
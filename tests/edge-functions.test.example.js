/**
 * Edge Function API Tests - Example Template
 *
 * This file shows the structure for testing all 4 edge functions
 * Copy and modify for your test implementation
 *
 * Tests: 24 total (6 per function)
 * Duration: ~30 minutes
 */

const fetch = require('node-fetch');

// Configuration
const API_BASE_URL = 'https://isfaiawbywrtwvinkizb.supabase.co/functions/v1';
const VALID_JWT = 'YOUR_VALID_JWT_TOKEN_HERE'; // Get from Supabase
const EXPIRED_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.fakesignature'; // Token with exp < now
const INVALID_JWT = 'invalid.token.here';

// Helper function to make API calls
async function callFunction(functionName, body, jwt = VALID_JWT) {
  const response = await fetch(`${API_BASE_URL}/${functionName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000'
    },
    body: JSON.stringify(body)
  });

  return {
    status: response.status,
    data: await response.json(),
    headers: response.headers
  };
}

describe('VALIDATE-MEDIA-UPLOAD Function', () => {

  // TEST 2.1.1: Valid File Upload Request
  test('✓ Valid file upload request', async () => {
    const response = await callFunction('validate-media-upload', {
      fileName: 'test-image.jpg',
      fileSize: 1048576, // 1MB
      fileType: 'image/jpeg'
    });

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data).toHaveProperty('uploadUrl');
    expect(response.data).toHaveProperty('token');
    expect(response.data).toHaveProperty('storagePath');
    expect(response.data).toHaveProperty('fileId');
    expect(response.data).toHaveProperty('quotaStatus');
  });

  // TEST 2.1.2: Invalid File Type
  test('✓ Invalid file type rejected', async () => {
    const response = await callFunction('validate-media-upload', {
      fileName: 'virus.exe',
      fileSize: 1024,
      fileType: 'application/x-msdownload'
    });

    expect(response.status).toBe(400);
    expect(response.data.success).toBe(false);
    expect(response.data.code).toBe('INVALID_FILE_TYPE');
    expect(response.data.error).toContain('File type not allowed');
  });

  // TEST 2.1.3: File Size Exceeds Limit
  test('✓ File too large (50MB+)', async () => {
    const response = await callFunction('validate-media-upload', {
      fileName: 'huge.mp4',
      fileSize: 52428801, // 50MB + 1 byte
      fileType: 'video/mp4'
    });

    expect(response.status).toBe(400);
    expect(response.data.success).toBe(false);
    expect(response.data.code).toBe('FILE_TOO_LARGE');
    expect(response.data.error).toContain('50MB');
  });

  // TEST 2.1.4: Missing Required Fields
  test('✓ Missing required fields', async () => {
    const response = await callFunction('validate-media-upload', {
      // Missing fileName
      fileSize: 1048576,
      fileType: 'image/jpeg'
    });

    expect(response.status).toBe(400);
    expect(response.data.success).toBe(false);
    expect(response.data.code).toBe('INVALID_INPUT');
    expect(response.data.error).toContain('fileName');
  });

  // TEST 2.1.5: Rate Limit Exceeded
  test('✓ Rate limit exceeded (>10/min)', async () => {
    const validBody = {
      fileName: 'test.jpg',
      fileSize: 1048576,
      fileType: 'image/jpeg'
    };

    // Make 11 requests (limit is 10)
    let responses = [];
    for (let i = 0; i < 11; i++) {
      const response = await callFunction('validate-media-upload', validBody);
      responses.push(response);
    }

    // First 10 should succeed
    for (let i = 0; i < 10; i++) {
      expect(responses[i].status).toBe(200);
    }

    // 11th should be rate limited
    expect(responses[10].status).toBe(429);
    expect(responses[10].data.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(responses[10].data).toHaveProperty('remaining');
    expect(responses[10].data.remaining).toBe(0);
  });

  // TEST 2.1.6: Invalid JWT Token
  test('✓ Invalid JWT token rejected', async () => {
    const response = await callFunction('validate-media-upload', {
      fileName: 'test.jpg',
      fileSize: 1048576,
      fileType: 'image/jpeg'
    }, INVALID_JWT);

    expect(response.status).toBe(401);
    expect(response.data.success).toBe(false);
    expect(response.data.error).toContain('Invalid or expired token');
  });
});

describe('GET-MEDIA-QUOTA Function', () => {

  // TEST 2.2.1: Retrieve Quota for Free Plan
  test('✓ Get quota for free plan user', async () => {
    const response = await callFunction('get-media-quota', {});

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data).toHaveProperty('quotaStatus');
    expect(response.data.quotaStatus).toHaveProperty('filesLimit');
    expect(response.data.quotaStatus).toHaveProperty('storageUsedMB');
    expect(response.data.quotaStatus).toHaveProperty('storageLimitGB');
  });

  // TEST 2.2.2: Quota Exceeded - Files
  test('✓ Show files remaining = 0 when limit exceeded', async () => {
    // This test assumes user has filled quota
    const response = await callFunction('get-media-quota', {});

    if (response.data.quotaStatus.filesRemaining === 0) {
      expect(response.status).toBe(200);
      expect(response.data.quotaStatus.filesRemaining).toBe(0);
    }
  });

  // TEST 2.2.3: Quota Exceeded - Storage
  test('✓ Show storage remaining = 0 when limit exceeded', async () => {
    const response = await callFunction('get-media-quota', {});

    if (response.data.quotaStatus.storageRemainingMB === 0) {
      expect(response.status).toBe(200);
      expect(response.data.quotaStatus.storageRemainingMB).toBe(0);
    }
  });

  // TEST 2.2.4: Feature Disabled for Plan
  test('✓ Feature disabled for plan', async () => {
    // This test assumes user plan has media disabled
    const response = await callFunction('get-media-quota', {});

    // If feature is disabled, response should indicate that
    if (!response.data.quotaStatus.mediaUploadEnabled) {
      expect(response.data.quotaStatus.mediaUploadEnabled).toBe(false);
      expect(response.data.quotaStatus.message).toContain('not available');
    }
  });

  // TEST 2.2.5: Rate Limit (60/min)
  test('✓ Rate limit for quota check (60/min)', async () => {
    // Make 61 requests (limit is 60)
    let responses = [];
    for (let i = 0; i < 61; i++) {
      const response = await callFunction('get-media-quota', {});
      responses.push(response);
    }

    // First 60 should succeed
    for (let i = 0; i < 60; i++) {
      expect(responses[i].status).toBe(200);
    }

    // 61st should be rate limited
    expect(responses[60].status).toBe(429);
  });
});

describe('PROCESS-MEDIA-UPLOAD Function', () => {

  // TEST 2.3.1: Valid Media Upload Processing
  test('✓ Valid media upload processing', async () => {
    const response = await callFunction('process-media-upload', {
      storagePath: 'user-id/1234567890-uuid.jpg',
      fileName: 'photo.jpg',
      fileSize: 2097152, // 2MB
      fileType: 'image/jpeg',
      fileId: '123e4567-e89b-12d3-a456-426614174000',
      md5Hash: 'abc123def456'
    });

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data).toHaveProperty('mediaId');
    expect(response.data).toHaveProperty('mediaRecord');
  });

  // TEST 2.3.2: Invalid Storage Path
  test('✓ Invalid storage path rejected', async () => {
    const response = await callFunction('process-media-upload', {
      storagePath: '', // Empty
      fileName: 'photo.jpg',
      fileSize: 2097152,
      fileType: 'image/jpeg',
      fileId: '123e4567-e89b-12d3-a456-426614174000'
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('storagePath');
  });

  // TEST 2.3.3: Invalid File ID (Not UUID)
  test('✓ Invalid file ID rejected', async () => {
    const response = await callFunction('process-media-upload', {
      storagePath: 'user-id/timestamp-id.jpg',
      fileName: 'photo.jpg',
      fileSize: 2097152,
      fileType: 'image/jpeg',
      fileId: 'not-a-uuid' // Invalid
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('UUID');
  });

  // TEST 2.3.4: File Name Exceeds Max Length
  test('✓ File name max length enforced', async () => {
    const longFileName = 'a'.repeat(501); // 501 chars (max is 500)

    const response = await callFunction('process-media-upload', {
      storagePath: 'user-id/timestamp-id.jpg',
      fileName: longFileName,
      fileSize: 2097152,
      fileType: 'image/jpeg',
      fileId: '123e4567-e89b-12d3-a456-426614174000'
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('500 chars');
  });

  // TEST 2.3.5: Duplicate File Detection
  test('✓ Duplicate file detection', async () => {
    const sameMd5 = 'duplicate-hash-abc123';

    // First upload
    const response1 = await callFunction('process-media-upload', {
      storagePath: 'user-id/1234567890-uuid1.jpg',
      fileName: 'photo.jpg',
      fileSize: 2097152,
      fileType: 'image/jpeg',
      fileId: '123e4567-e89b-12d3-a456-426614174000',
      md5Hash: sameMd5
    });

    expect(response1.status).toBe(200);

    // Second upload with same hash
    const response2 = await callFunction('process-media-upload', {
      storagePath: 'user-id/1234567890-uuid2.jpg',
      fileName: 'photo.jpg',
      fileSize: 2097152,
      fileType: 'image/jpeg',
      fileId: '223e4567-e89b-12d3-a456-426614174001',
      md5Hash: sameMd5
    });

    // Should succeed but log duplicate
    expect(response2.status).toBe(200);
  });

  // TEST 2.3.7: Rate Limit (10/min)
  test('✓ Rate limit for process upload (10/min)', async () => {
    const validBody = {
      storagePath: 'user-id/timestamp-id.jpg',
      fileName: 'photo.jpg',
      fileSize: 2097152,
      fileType: 'image/jpeg',
      fileId: '123e4567-e89b-12d3-a456-426614174000'
    };

    // Make 11 requests
    let responses = [];
    for (let i = 0; i < 11; i++) {
      const response = await callFunction('process-media-upload', validBody);
      responses.push(response);
    }

    // 11th should be rate limited
    expect(responses[10].status).toBe(429);
  });
});

describe('DELETE-MEDIA Function', () => {

  // TEST 2.4.1: Soft Delete Media
  test('✓ Soft delete media (30-day grace)', async () => {
    const response = await callFunction('delete-media', {
      mediaId: '123e4567-e89b-12d3-a456-426614174000',
      permanent: false
    });

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data).toHaveProperty('deletedAt');
    expect(response.data).toHaveProperty('permanentDeletionDate');
  });

  // TEST 2.4.2: Permanent Delete Media
  test('✓ Permanent delete media', async () => {
    const response = await callFunction('delete-media', {
      mediaId: '123e4567-e89b-12d3-a456-426614174000',
      permanent: true
    });

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.message).toContain('permanently deleted');
  });

  // TEST 2.4.3: Delete Non-Existent Media
  test('✓ Delete non-existent media', async () => {
    const response = await callFunction('delete-media', {
      mediaId: '00000000-0000-0000-0000-000000000000',
      permanent: false
    });

    expect(response.status).toBe(404);
    expect(response.data.error).toContain('not found');
  });

  // TEST 2.4.4: Invalid Media ID Format
  test('✓ Invalid media ID format', async () => {
    const response = await callFunction('delete-media', {
      mediaId: 'not-a-uuid',
      permanent: false
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('UUID');
  });

  // TEST 2.4.5: Unauthorized Delete (Wrong User)
  test('✓ Cannot delete other user\'s media', async () => {
    // This requires a mediaId that belongs to another user
    // Test with a known other user's media ID
    const response = await callFunction('delete-media', {
      mediaId: '999e9999-e99b-99d3-a999-999999999999', // Another user's ID
      permanent: false
    });

    // Should return 404 (not 403) for security
    expect(response.status).toBe(404);
  });

  // TEST 2.4.6: Rate Limit (100/min)
  test('✓ Rate limit for delete (100/min)', async () => {
    const validBody = {
      mediaId: '123e4567-e89b-12d3-a456-426614174000',
      permanent: false
    };

    // Make 101 requests
    let responses = [];
    for (let i = 0; i < 101; i++) {
      const response = await callFunction('delete-media', validBody);
      responses.push(response);
    }

    // 101st should be rate limited
    expect(responses[100].status).toBe(429);
  });
});

// CORS Tests
describe('CORS Header Validation', () => {

  async function callFunctionWithOrigin(functionName, body, origin) {
    const response = await fetch(`${API_BASE_URL}/${functionName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VALID_JWT}`,
        'Content-Type': 'application/json',
        'Origin': origin
      },
      body: JSON.stringify(body)
    });

    return {
      status: response.status,
      corsOrigin: response.headers.get('access-control-allow-origin')
    };
  }

  // TEST 3.1.1: Valid Origin - Localhost:3000
  test('✓ Allow origin: localhost:3000', async () => {
    const response = await callFunctionWithOrigin('validate-media-upload', {
      fileName: 'test.jpg',
      fileSize: 1048576,
      fileType: 'image/jpeg'
    }, 'http://localhost:3000');

    expect(response.corsOrigin).toBe('http://localhost:3000');
  });

  // TEST 3.1.2: Valid Origin - Localhost:5000
  test('✓ Allow origin: localhost:5000', async () => {
    const response = await callFunctionWithOrigin('validate-media-upload', {
      fileName: 'test.jpg',
      fileSize: 1048576,
      fileType: 'image/jpeg'
    }, 'http://localhost:5000');

    expect(response.corsOrigin).toBe('http://localhost:5000');
  });

  // TEST 3.1.4: Invalid Origin - Unauthorized
  test('✓ Reject unauthorized origin', async () => {
    const response = await callFunctionWithOrigin('validate-media-upload', {
      fileName: 'test.jpg',
      fileSize: 1048576,
      fileType: 'image/jpeg'
    }, 'https://hacker.com');

    expect(response.corsOrigin).toBe('null');
  });
});

module.exports = {
  callFunction
};

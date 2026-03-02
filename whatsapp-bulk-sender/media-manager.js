/**
 * Media Manager - Handles all media operations with Supabase Edge Functions
 * Manages upload validation, quota checking, processing, and deletion
 */

class MediaManager {
  constructor(supabaseUrl, anonKey, jwtToken) {
    this.supabaseUrl = supabaseUrl;
    this.anonKey = anonKey;
    this.jwtToken = jwtToken;

    this.MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    this.ALLOWED_TYPES = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'application/pdf',
    ];

    this.FUNCTIONS = {
      VALIDATE: '/functions/v1/validate-media-upload',
      QUOTA: '/functions/v1/get-media-quota',
      PROCESS: '/functions/v1/process-media-upload',
      DELETE: '/functions/v1/delete-media',
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Check if file is valid before upload
   */
  validateFile(file) {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File exceeds maximum size of 50MB (${this.formatBytes(file.size)})`,
        code: 'FILE_TOO_LARGE',
      };
    }

    // Check file type
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: 'File type not supported. Allowed: Images (JPEG, PNG, GIF, WebP), Videos (MP4, MOV, WebM), PDF',
        code: 'INVALID_FILE_TYPE',
      };
    }

    return { valid: true };
  }

  /**
   * Get current user's media quota
   */
  async getQuota() {
    try {
      const response = await fetch(
        `${this.supabaseUrl}${this.FUNCTIONS.QUOTA}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.jwtToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch quota');
      }

      return await response.json();
    } catch (error) {
      console.error('Get quota error:', error);
      throw error;
    }
  }

  /**
   * Validate upload and get signed URL
   */
  async validateUpload(file) {
    try {
      // Client-side validation first
      const validation = this.validateFile(file);
      if (!validation.valid) {
        throw { ...validation };
      }

      // Server-side validation and signed URL generation
      const response = await fetch(
        `${this.supabaseUrl}${this.FUNCTIONS.VALIDATE}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.jwtToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw {
          valid: false,
          error: error.error,
          code: error.code,
        };
      }

      return {
        valid: true,
        data: await response.json(),
      };
    } catch (error) {
      console.error('Validate upload error:', error);
      throw error;
    }
  }

  /**
   * Upload file directly to Storage using signed URL
   */
  async uploadToStorage(file, signedUrl, onProgress) {
    try {
      // For large files, use chunked upload (optional)
      if (file.size > 10 * 1024 * 1024) {
        return this.uploadChunked(file, signedUrl, onProgress);
      }

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        if (onProgress) {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percent = (e.loaded / e.total) * 100;
              onProgress(percent);
            }
          });
        }

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ success: true });
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed (network error)'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        xhr.open('POST', signedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });
    } catch (error) {
      console.error('Upload to storage error:', error);
      throw error;
    }
  }

  /**
   * Chunked upload for large files
   */
  async uploadChunked(file, signedUrl, onProgress) {
    const chunkSize = 5 * 1024 * 1024; // 5MB chunks
    const chunks = Math.ceil(file.size / chunkSize);

    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      try {
        await fetch(signedUrl, {
          method: 'POST',
          headers: {
            'Content-Type': file.type,
            'Content-Range': `bytes ${start}-${end - 1}/${file.size}`,
          },
          body: chunk,
        });

        if (onProgress) {
          onProgress(((i + 1) / chunks) * 100);
        }
      } catch (error) {
        throw new Error(`Chunk upload failed at ${i + 1}/${chunks}`);
      }
    }

    return { success: true };
  }

  /**
   * Calculate MD5 hash of file (for duplicate detection)
   */
  async calculateHash(file) {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('Hash calculation error:', error);
      return null;
    }
  }

  /**
   * Process upload after file is in Storage
   */
  async processUpload(uploadData, file) {
    try {
      // Calculate file hash for duplicate detection
      const md5Hash = await this.calculateHash(file);

      const response = await fetch(
        `${this.supabaseUrl}${this.FUNCTIONS.PROCESS}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.jwtToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            storagePath: uploadData.storagePath,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            fileId: uploadData.fileId,
            md5Hash,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process upload');
      }

      return await response.json();
    } catch (error) {
      console.error('Process upload error:', error);
      throw error;
    }
  }

  /**
   * Complete upload flow: validate → upload → process
   */
  async uploadMedia(file, onProgress) {
    try {
      // Step 1: Validate and get signed URL
      const validation = await this.validateUpload(file);
      if (!validation.valid) {
        throw validation;
      }

      const { uploadUrl, storagePath, fileId, quotaStatus } = validation.data;

      // Step 2: Upload file to Storage
      await this.uploadToStorage(file, uploadUrl, onProgress);

      // Step 3: Process upload (metadata, encryption, analytics)
      const processed = await this.processUpload(
        { storagePath, fileId },
        file
      );

      return {
        success: true,
        mediaId: processed.mediaId,
        mediaRecord: processed.mediaRecord,
        quotaStatus,
      };
    } catch (error) {
      console.error('Upload media error:', error);
      throw error;
    }
  }

  /**
   * Delete media (soft or permanent)
   */
  async deleteMedia(mediaId, permanent = false) {
    try {
      const response = await fetch(
        `${this.supabaseUrl}${this.FUNCTIONS.DELETE}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.jwtToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mediaId,
            permanent,
            reason: 'user_request',
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete media');
      }

      return await response.json();
    } catch (error) {
      console.error('Delete media error:', error);
      throw error;
    }
  }

  /**
   * Check if media upload is allowed for current user
   */
  async canUpload() {
    try {
      const quota = await this.getQuota();
      const { quotaStatus } = quota;

      if (!quotaStatus.mediaUploadEnabled) {
        return {
          allowed: false,
          reason: 'Media upload is not enabled for your plan',
        };
      }

      if (quotaStatus.filesRemaining === 0) {
        return {
          allowed: false,
          reason: 'Daily file limit reached',
        };
      }

      if (quotaStatus.storageRemainingMB === 0) {
        return {
          allowed: false,
          reason: 'Storage limit reached',
        };
      }

      return {
        allowed: true,
        quotaStatus,
      };
    } catch (error) {
      console.error('Can upload check error:', error);
      return {
        allowed: false,
        reason: 'Failed to check quota',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Utility Functions
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get human-readable file type
   */
  getFileTypeLabel(mimeType) {
    const types = {
      'image/jpeg': '📷 JPEG Image',
      'image/png': '📷 PNG Image',
      'image/gif': '📷 GIF Image',
      'image/webp': '📷 WebP Image',
      'video/mp4': '🎥 MP4 Video',
      'video/quicktime': '🎥 MOV Video',
      'video/webm': '🎥 WebM Video',
      'application/pdf': '📄 PDF Document',
    };

    return types[mimeType] || mimeType;
  }

  /**
   * Check if file is image
   */
  isImage(mimeType) {
    return mimeType.startsWith('image/');
  }

  /**
   * Check if file is video
   */
  isVideo(mimeType) {
    return mimeType.startsWith('video/');
  }

  /**
   * Check if file is document
   */
  isDocument(mimeType) {
    return mimeType === 'application/pdf';
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MediaManager;
}

// Also expose globally for popup.js
window.MediaManager = MediaManager;

const axios = require('axios');
const path = require('path');
require('dotenv').config();

const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || 'jdmdex';
const BUNNY_PULL_ZONE = process.env.BUNNY_PULL_ZONE || 'jdmdex-cdn.loocist23.fr';

if (!BUNNY_API_KEY) {
  console.warn('WARNING: BUNNY_API_KEY is not set. Files will not be uploaded to Bunny CDN.');
}

const bunnyApi = axios.create({
  baseURL: `https://storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/`,
  headers: {
    'AccessKey': BUNNY_API_KEY,
  },
});

/**
 * Upload a file to Bunny CDN
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - File name with extension
 * @returns {Promise<string>} Public URL of the uploaded file
 */
async function uploadFile(fileBuffer, fileName) {
  try {
    if (!BUNNY_API_KEY) {
      throw new Error('BUNNY_API_KEY is not configured');
    }

    const response = await bunnyApi.put(fileName, fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });

    if (response.status === 201 || response.status === 200) {
      return `https://${BUNNY_PULL_ZONE}/${fileName}`;
    }
    throw new Error(`Bunny upload failed with status: ${response.status}`);
  } catch (error) {
    console.error('Bunny upload error:', error.message);
    if (error.response) {
      console.error('Bunny response:', error.response.data);
    }
    throw error;
  }
}

/**
 * Delete a file from Bunny CDN
 * @param {string} fileName - File name to delete
 * @returns {Promise<boolean>} Success status
 */
async function deleteFile(fileName) {
  try {
    if (!BUNNY_API_KEY) {
      console.warn('BUNNY_API_KEY not configured, cannot delete from Bunny CDN');
      return false;
    }

    const response = await bunnyApi.delete(fileName);
    return response.status === 204 || response.status === 200;
  } catch (error) {
    console.error('Bunny delete error:', error.message);
    if (error.response) {
      console.error('Bunny delete response:', error.response.data);
    }
    return false;
  }
}

/**
 * Generate a unique filename
 * @param {string} originalName - Original file name
 * @returns {string} Unique filename
 */
function generateFileName(originalName) {
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const ext = path.extname(originalName);
  return `${unique}${ext}`;
}

/**
 * Generate a unique file path with user and car directories
 * @param {number} userId - User ID
 * @param {number|string} carId - Car ID
 * @param {string} originalName - Original file name
 * @returns {string} Full path like users/1/cars/5/123456789.jpg
 */
function generateFilePath(userId, carId, originalName) {
  const fileName = generateFileName(originalName);
  return `users/${userId}/cars/${carId}/${fileName}`;
}

/**
 * Generate a unique file path for profile pictures
 * @param {number} userId - User ID
 * @param {string} originalName - Original file name
 * @returns {string} Full path like users/1/profile/123456789.jpg
 */
function generateProfilePath(userId, originalName) {
  const fileName = generateFileName(originalName);
  return `users/${userId}/profile/${fileName}`;
}

/**
 * Extract file path components from a full Bunny path
 * @param {string} filePath - Full path like users/1/cars/5/123456789.jpg
 * @returns {string} Just the filename part
 */
function extractFileName(filePath) {
  const parts = filePath.split('/');
  return parts.slice(-1)[0];
}

module.exports = {
  uploadFile,
  deleteFile,
  generateFileName,
  generateFilePath,
  generateProfilePath,
  extractFileName,
  getPublicUrl: (filePath) => `https://${BUNNY_PULL_ZONE}/${filePath}`,
};

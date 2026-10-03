const { put } = require('@vercel/blob');

/**
 * Uploads a buffer to Vercel Blob and returns its public URL. Used for
 * profile pictures, workspace images, and generated invoice PDFs — Vercel's
 * serverless filesystem isn't persistent, so these can no longer be written
 * to a local uploads/ folder.
 * @param {String} pathname - destination path/filename within the Blob store
 * @param {Buffer} buffer
 * @param {String} contentType
 */
const uploadToBlob = async (pathname, buffer, contentType) => {
  const blob = await put(pathname, buffer, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return blob.url;
};

module.exports = { uploadToBlob };

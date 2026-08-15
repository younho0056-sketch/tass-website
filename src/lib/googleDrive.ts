import { google } from 'googleapis';
import { Readable } from 'stream';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file'
];

export function getGoogleDriveClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    return null;
  }

  // Robustly handle surrounding quotes, escaped newlines, and whitespace
  privateKey = privateKey
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\\n/g, '\n');

  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    console.error('[GoogleDrive] Invalid privateKey format: missing BEGIN PRIVATE KEY header');
    return null;
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES,
  });

  return google.drive({ version: 'v3', auth });
}

export async function findOrCreateDriveFolder(
  drive: ReturnType<typeof google.drive>,
  folderName: string,
  parentFolderId?: string
): Promise<string | null> {
  try {
    let query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (parentFolderId) {
      query += ` and '${parentFolderId}' in parents`;
    }

    const searchRes = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    if (searchRes.data.files && searchRes.data.files.length > 0) {
      return searchRes.data.files[0].id || null;
    }

    // Folder doesn't exist, create it
    const fileMetadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };

    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }

    const folderRes = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
      supportsAllDrives: true
    });

    return folderRes.data.id || null;
  } catch (err) {
    console.error('[GoogleDrive] Error finding/creating folder:', err);
    return null;
  }
}

export async function uploadBufferToGoogleDrive({
  fileName,
  mimeType,
  buffer,
  projectNo
}: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  projectNo: string;
}): Promise<{ success: boolean; fileId?: string; webViewLink?: string; reason?: string }> {
  try {
    const drive = getGoogleDriveClient();
    if (!drive) {
      return {
        success: false,
        reason: 'GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY is not configured in environment variables'
      };
    }

    const parentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || undefined;
    const folderId = await findOrCreateDriveFolder(drive, projectNo, parentId);

    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileMetadata: any = {
      name: fileName,
      parents: folderId ? [folderId] : parentId ? [parentId] : undefined
    };

    const media = {
      mimeType: mimeType || 'image/jpeg',
      body: stream
    };

    const fileRes = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
      supportsAllDrives: true
    });

    return {
      success: true,
      fileId: fileRes.data.id || undefined,
      webViewLink: fileRes.data.webViewLink || undefined
    };
  } catch (err: any) {
    console.error('[GoogleDrive] Upload error:', err);
    return {
      success: false,
      reason: err.message || 'Drive API upload failed'
    };
  }
}

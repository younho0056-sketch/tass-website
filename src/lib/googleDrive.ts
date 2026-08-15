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

export async function findSharedWithMeFolders(drive: ReturnType<typeof google.drive>) {
  try {
    const res = await drive.files.list({
      q: "sharedWithMe = true and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name, mimeType, permissions, owners)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      supportsTeamDrives: true,
      includeTeamDriveItems: true,
      pageSize: 30
    });
    return res.data.files || [];
  } catch (err) {
    console.error('[GoogleDrive] Error listing sharedWithMe folders:', err);
    return [];
  }
}

export async function getRootParentFolder(
  drive: ReturnType<typeof google.drive>,
  targetFolderId?: string
): Promise<{ id: string; name: string; method: string }> {
  const HARDCODED_ROOT_ID = '13kS6BLYxlVlTlydnv7DGBrU3jG5kjsAZ';
  const envFolderId = targetFolderId || process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || HARDCODED_ROOT_ID;

  // 1. Direct ID lookup if env ID provided
  if (envFolderId && envFolderId.trim()) {
    try {
      const res = await drive.files.get({
        fileId: envFolderId.trim(),
        fields: 'id, name, mimeType',
        supportsAllDrives: true,
        supportsTeamDrives: true
      });
      if (res.data && res.data.id) {
        return {
          id: res.data.id,
          name: res.data.name || envFolderId,
          method: 'direct_id'
        };
      }
    } catch (err: any) {
      console.warn(`[GoogleDrive] Direct folder ID (${envFolderId}) lookup failed: ${err.message}. Trying Fallback search...`);
    }
  }

  // 2. Fallback A: Search by name '타스_도면'
  try {
    const searchByName = await drive.files.list({
      q: "name = '타스_도면' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      supportsTeamDrives: true,
      includeTeamDriveItems: true
    });
    if (searchByName.data.files && searchByName.data.files.length > 0 && searchByName.data.files[0].id) {
      return {
        id: searchByName.data.files[0].id,
        name: searchByName.data.files[0].name || '타스_도면',
        method: 'name_search_tas_drawing'
      };
    }
  } catch (err) {
    console.warn('[GoogleDrive] Name search for 타스_도면 failed:', err);
  }

  // 3. Fallback B: Search sharedWithMe folders
  const sharedFolders = await findSharedWithMeFolders(drive);
  if (sharedFolders.length > 0) {
    const tasFolder = sharedFolders.find(f => f.name?.includes('타스') || f.name?.includes('TASS'));
    const target = tasFolder || sharedFolders[0];
    if (target.id) {
      return {
        id: target.id,
        name: target.name || 'Shared Folder',
        method: 'shared_with_me'
      };
    }
  }

  // 4. Guaranteed Hardcoded Fallback (Never returns null)
  return {
    id: HARDCODED_ROOT_ID,
    name: '타스_도면',
    method: 'hardcoded_root_fallback'
  };
}

/**
 * 1단계 공통 함수: 루트 기준 폴더 ID를 탐색하여 수급 (보장된 rootId 반환)
 */
export async function getResolvedRootFolderId(drive: ReturnType<typeof google.drive>): Promise<string> {
  const rootInfo = await getRootParentFolder(drive);
  if (!rootInfo || !rootInfo.id) {
    throw new Error('Target Folder ID missing (Root ID unresolved)');
  }
  return rootInfo.id;
}

export async function findOrCreateDriveSubFolder(
  drive: ReturnType<typeof google.drive>,
  folderName: string,
  parentFolderId: string
): Promise<string | null> {
  if (!parentFolderId || !parentFolderId.trim()) {
    console.warn(`[GoogleDrive] Cannot create subfolder '${folderName}' without a parentFolderId.`);
    return null;
  }

  const cleanParentId = parentFolderId.trim();

  try {
    const query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${cleanParentId}' in parents`;

    const searchRes = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      supportsTeamDrives: true,
      includeTeamDriveItems: true
    });

    if (searchRes.data.files && searchRes.data.files.length > 0 && searchRes.data.files[0].id) {
      return searchRes.data.files[0].id;
    }

    // Folder doesn't exist under parentFolderId, create it explicitly with parents: [cleanParentId]
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [cleanParentId]
    };

    const folderRes = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
      supportsAllDrives: true,
      supportsTeamDrives: true
    });

    return folderRes.data.id || null;
  } catch (err: any) {
    console.warn(`[GoogleDrive] Warning creating subfolder '${folderName}' under '${cleanParentId}': ${err.message}`);
    return null;
  }
}

export async function findOrCreateDriveFolderHierarchy(
  drive: ReturnType<typeof google.drive>,
  {
    partnerName,
    projectNo
  }: {
    partnerName?: string;
    projectNo: string;
  }
): Promise<{ rootId: string; rootFolderId: string; partnerFolderId: string | null; projectFolderId: string | null; targetFolderId: string }> {
  // Step 1: Get Root Parent Folder ID (hardcoded fallback guaranteed)
  const rootId = await getResolvedRootFolderId(drive);
  console.log('[URGENT-DEBUG] Step 1 Root Folder ID:', rootId);

  // Step 2: Find or create Partner Folder (e.g. '아크인터내셔널') under Root Folder
  const cleanPartnerName = partnerName && partnerName.trim() ? partnerName.trim() : '일반거래처';
  const partnerFolderId = await findOrCreateDriveSubFolder(drive, cleanPartnerName, rootId);
  console.log('[URGENT-DEBUG] Step 2 Partner Folder ID:', partnerFolderId);

  // Step 3: Find or create Project Folder (e.g. 'PRJ-023') under Partner Folder
  const parentForProject = partnerFolderId || rootId;
  const projectFolderId = await findOrCreateDriveSubFolder(drive, projectNo, parentForProject);
  console.log('[URGENT-DEBUG] Step 3 Project Folder ID:', projectFolderId);

  const finalTargetFolderId = projectFolderId || partnerFolderId || rootId;
  console.log('[URGENT-DEBUG] Final Target Folder ID:', finalTargetFolderId);

  return {
    rootId,
    rootFolderId: rootId,
    partnerFolderId,
    projectFolderId,
    targetFolderId: finalTargetFolderId
  };
}

export const findOrCreateFolderPath = findOrCreateDriveFolderHierarchy;

export async function uploadBufferToGoogleDrive({
  fileName,
  mimeType,
  buffer,
  projectNo,
  partnerName
}: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  projectNo: string;
  partnerName?: string;
}): Promise<{ success: boolean; fileId?: string; webViewLink?: string; targetFolderId?: string; reason?: string }> {
  try {
    const drive = getGoogleDriveClient();
    if (!drive) {
      const errorMsg = '[GoogleDrive Error] GOOGLE_SERVICE_ACCOUNT_EMAIL 또는 GOOGLE_PRIVATE_KEY가 Vercel 환경변수에 설정되어 있지 않습니다.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Step 1 ~ 3: Folder Navigation
    const { rootId, partnerFolderId, projectFolderId, targetFolderId: resolvedTargetId } = await findOrCreateDriveFolderHierarchy(drive, { partnerName, projectNo });

    const targetFolderId = (projectFolderId || resolvedTargetId || rootId || '').trim();
    console.log('[URGENT-DEBUG] Final Target Folder ID:', targetFolderId);

    if (!targetFolderId) {
      throw new Error('Target Folder ID missing');
    }

    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // Step 4: File Creation with parents: [targetFolderId]
    const fileRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [targetFolderId],
      },
      media: {
        mimeType: mimeType || 'image/jpeg',
        body: stream,
      },
      fields: 'id, name, webViewLink, webContentLink',
      supportsAllDrives: true,
      supportsTeamDrives: true,
    });

    console.log(`[GoogleDrive] File uploaded successfully. File ID: ${fileRes.data.id}, Target Folder: ${targetFolderId}`);

    return {
      success: true,
      fileId: fileRes.data.id || undefined,
      webViewLink: fileRes.data.webViewLink || undefined,
      targetFolderId
    };
  } catch (err: any) {
    console.error('[GoogleDrive Upload Error]:', err);
    return {
      success: false,
      reason: err.message || 'Drive API 파일 업로드 실패'
    };
  }
}

export const uploadOrderPhoto = uploadBufferToGoogleDrive;

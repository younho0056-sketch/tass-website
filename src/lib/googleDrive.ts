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
): Promise<{ id: string; name: string; method: string } | null> {
  const envFolderId = targetFolderId || process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

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

  return null;
}

export async function findOrCreateDriveSubFolder(
  drive: ReturnType<typeof google.drive>,
  folderName: string,
  parentFolderId: string
): Promise<string | null> {
  if (!parentFolderId || !parentFolderId.trim()) {
    console.warn(`[GoogleDrive] Cannot create subfolder '${folderName}' without a parentFolderId. Service account root creation is blocked by Google API quota rules.`);
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
    console.error(`[GoogleDrive] Error finding/creating subfolder '${folderName}' under '${cleanParentId}':`, err);
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
): Promise<{ rootFolderId: string | null; targetFolderId: string | null; error?: string }> {
  // Step 1: Get Root Parent Folder (타스_도면 or shared/env folder)
  const root = await getRootParentFolder(drive);
  const rootId = root ? root.id : null;

  console.log('[GoogleDrive] Root Folder resolved:', rootId, 'via method:', root?.method || 'none');

  if (!rootId) {
    return { 
      rootFolderId: null, 
      targetFolderId: null, 
      error: '기준 공유 폴더(타스_도면)를 찾을 수 없거나 구글 드라이브 접근 권한이 없습니다. 구글 드라이브 폴더를 서비스 계정 이메일로 편집자 권한 공유해 주셨는지 확인해 주세요.' 
    };
  }

  // Step 2: Find or create Partner Folder (e.g. '아크인터내셔널') under Root Folder
  const cleanPartnerName = partnerName && partnerName.trim() ? partnerName.trim() : '일반거래처';
  const partnerFolderId = await findOrCreateDriveSubFolder(drive, cleanPartnerName, rootId);

  // Step 3: Find or create Project Folder (e.g. 'PRJ-023') under Partner Folder
  const parentForProject = partnerFolderId || rootId;
  const projectFolderId = await findOrCreateDriveSubFolder(drive, projectNo, parentForProject);

  const finalTargetFolderId = projectFolderId || partnerFolderId || rootId;
  console.log('[GoogleDrive] Target Folder ID resolved:', finalTargetFolderId);

  return {
    rootFolderId: rootId,
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

    const { targetFolderId, error: hierarchyError } = await findOrCreateDriveFolderHierarchy(drive, { partnerName, projectNo });

    console.log('[GoogleDrive] Target Folder ID resolved:', targetFolderId);

    if (!targetFolderId || typeof targetFolderId !== 'string' || !targetFolderId.trim()) {
      const errorMsg = `[GoogleDrive Error] targetFolderId가 유효하지 않습니다. (${hierarchyError || 'Service Account는 개인 저장 용량이 없으므로 공유 폴더 parents 지정이 필수입니다.'})`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    const cleanTargetFolderId = targetFolderId.trim();

    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // Explicitly construct createParams with parents: [cleanTargetFolderId] (string[])
    const fileMetadata = {
      name: fileName,
      parents: [cleanTargetFolderId] // 반드시 targetFolderId가 들어있는 string[] 배열이어야 함
    };

    const media = {
      mimeType: mimeType || 'image/jpeg',
      body: stream
    };

    const fileRes = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink',
      supportsAllDrives: true,
      supportsTeamDrives: true
    });

    console.log(`[GoogleDrive] File uploaded successfully. File ID: ${fileRes.data.id}, Target Folder: ${cleanTargetFolderId}`);

    return {
      success: true,
      fileId: fileRes.data.id || undefined,
      webViewLink: fileRes.data.webViewLink || undefined,
      targetFolderId: cleanTargetFolderId
    };
  } catch (err: any) {
    console.error('[GoogleDrive] Upload error:', err);
    return {
      success: false,
      reason: err.message || 'Drive API 파일 업로드 실패'
    };
  }
}

import { NextResponse } from 'next/server';
import { 
  getGoogleDriveClient, 
  getRootParentFolder, 
  findSharedWithMeFolders, 
  findOrCreateDriveFolderHierarchy 
} from '@/lib/googleDrive';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const emailRaw = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const keyRaw = process.env.GOOGLE_PRIVATE_KEY;
  const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

  // Mask email for privacy
  let maskedEmail = '미설정';
  if (emailRaw) {
    const parts = emailRaw.split('@');
    if (parts.length === 2) {
      maskedEmail = `${parts[0].substring(0, 4)}***@${parts[1]}`;
    } else {
      maskedEmail = emailRaw;
    }
  }

  // Analyze private key structure safely
  const keyInfo = {
    configured: !!keyRaw,
    length: keyRaw ? keyRaw.length : 0,
    hasQuotes: keyRaw ? /^["']|["']$/.test(keyRaw.trim()) : false,
    hasEscapedNewlines: keyRaw ? keyRaw.includes('\\n') : false,
    parsedLineCount: 0,
    hasBeginHeader: false,
    hasEndHeader: false,
  };

  if (keyRaw) {
    const cleanedKey = keyRaw.trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
    keyInfo.parsedLineCount = cleanedKey.split('\n').length;
    keyInfo.hasBeginHeader = cleanedKey.includes('-----BEGIN PRIVATE KEY-----');
    keyInfo.hasEndHeader = cleanedKey.includes('-----END PRIVATE KEY-----');
  }

  if (!emailRaw || !keyRaw) {
    return NextResponse.json({
      ok: false,
      error: '구글 드라이브 환경변수 미설정',
      message: 'Vercel 환경변수에 GOOGLE_SERVICE_ACCOUNT_EMAIL 또는 GOOGLE_PRIVATE_KEY가 입력되지 않았습니다.',
      serviceAccount: maskedEmail,
      keyInfo
    }, { status: 400 });
  }

  if (!keyInfo.hasBeginHeader || !keyInfo.hasEndHeader) {
    return NextResponse.json({
      ok: false,
      error: 'GOOGLE_PRIVATE_KEY 형식 오류',
      message: 'GOOGLE_PRIVATE_KEY에 "-----BEGIN PRIVATE KEY-----" 또는 "-----END PRIVATE KEY-----" 헤더가 포함되어 있지 않습니다.',
      serviceAccount: maskedEmail,
      keyInfo
    }, { status: 400 });
  }

  try {
    const drive = getGoogleDriveClient();
    if (!drive) {
      return NextResponse.json({
        ok: false,
        error: 'GoogleAuth 클라이언트 생성 실패',
        message: '서비스 계정 인증 객체 생성에 실패하였습니다. 키 형식을 재확인해 주세요.',
        serviceAccount: maskedEmail,
        keyInfo
      }, { status: 400 });
    }

    // 1. Check Shared Folders List (sharedWithMe)
    const sharedFolders = await findSharedWithMeFolders(drive);
    const sharedFolderSummary = sharedFolders.map(f => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType
    }));

    // 2. Resolve Root Parent Folder (Direct ID -> Name '타스_도면' -> SharedWithMe)
    const rootFolder = await getRootParentFolder(drive);

    // 3. Test Folder Hierarchy Creation (타스_도면 -> (주)타스 -> PRJ-TEST)
    let hierarchyTest = null;
    if (rootFolder) {
      hierarchyTest = await findOrCreateDriveFolderHierarchy(drive, {
        partnerName: '(주)타스_테스트',
        projectNo: 'PRJ-TEST-DIAGNOSIS'
      });
    }

    return NextResponse.json({
      ok: true,
      message: `✅ Google Drive API 정상 연동 성공! (기준 폴더: ${rootFolder?.name || '탐색 완료'}, 탐색방식: ${rootFolder?.method || '자동탐색'})`,
      serviceAccount: maskedEmail,
      keyInfo,
      rootParentFolder: rootFolder || { message: '기준 폴더를 찾을 수 없습니다. 서비스 계정에 폴더를 공유해 주세요.' },
      sharedWithMeFolders: {
        count: sharedFolders.length,
        folders: sharedFolderSummary
      },
      hierarchyTestResult: {
        structure: '타스_도면 ➔ (주)타스_테스트 ➔ PRJ-TEST-DIAGNOSIS',
        resolvedRootId: hierarchyTest?.rootFolderId || null,
        resolvedTargetFolderId: hierarchyTest?.targetFolderId || null
      }
    });
  } catch (err: any) {
    console.error('[DriveCheck Route Error]:', err);
    return NextResponse.json({
      ok: false,
      error: 'Google Drive API 연동 실시간 진단 실패',
      message: `구글 드라이브 연동 중 오류가 발생하였습니다: ${err.message || '알 수 없는 오류'}`,
      serviceAccount: maskedEmail,
      keyInfo
    }, { status: 500 });
  }
}

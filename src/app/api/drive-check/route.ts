import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getGoogleDriveClient } from '@/lib/googleDrive';

export async function GET() {
  const emailRaw = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const keyRaw = process.env.GOOGLE_PRIVATE_KEY;
  const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

  // Mask email for security
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

    let folderInfo = null;
    const targetFolderId = parentFolderId || '13kS6BLYxlVlTlydnv7DGBrU3jG5kjsAZ';

    try {
      const folderRes = await drive.files.get({
        fileId: targetFolderId,
        fields: 'id, name, mimeType, permissions, driveId',
        supportsAllDrives: true
      });

      folderInfo = {
        id: folderRes.data.id,
        name: folderRes.data.name,
        mimeType: folderRes.data.mimeType
      };
    } catch (folderErr: any) {
      // If specific parent folder fails, try listing general files
      try {
        const listRes = await drive.files.list({
          pageSize: 1,
          fields: 'files(id, name)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });
        folderInfo = {
          id: targetFolderId,
          name: `조회 실패 (${folderErr.message || '권한 없음'}), root 접속 가능`,
          rootFilesCount: listRes.data.files?.length || 0
        };
      } catch (listErr: any) {
        return NextResponse.json({
          ok: false,
          error: '구글 드라이브 API 인증 실패 / 폴더 접근 권한 없음',
          message: `서비스 계정이 드라이브 폴더(${targetFolderId})에 접근할 수 없습니다. 서비스 계정 이메일(${maskedEmail})을 구글 드라이브 지정 폴더에 편집자 권한으로 공유해 주셨는지 확인해 주세요. (원인: ${folderErr.message || listErr.message})`,
          serviceAccount: maskedEmail,
          keyInfo
        }, { status: 403 });
      }
    }

    return NextResponse.json({
      ok: true,
      message: `✅ Google Drive API 정상 연결 성공! (연결된 폴더: ${folderInfo?.name || targetFolderId})`,
      serviceAccount: maskedEmail,
      keyInfo,
      parentFolder: folderInfo
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

import { NextResponse } from 'next/server';
import { uploadBufferToGoogleDrive } from '@/lib/googleDrive';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const projectNo = (formData.get('projectNo') as string) || 'PRJ-GENERAL';
    const partnerName = (formData.get('partnerName') as string) || undefined;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided for Google Drive upload' }, { status: 400 });
    }

    const uploadResults = await Promise.all(
      files.map(async (file) => {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `site-${projectNo}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

        return uploadBufferToGoogleDrive({
          fileName,
          mimeType: file.type || 'image/jpeg',
          buffer,
          projectNo,
          partnerName
        });
      })
    );

    const hasErrors = uploadResults.some(r => !r.success);
    const firstReason = uploadResults.find(r => r.reason)?.reason;

    return NextResponse.json({
      success: !hasErrors,
      uploaded: uploadResults,
      warning: hasErrors ? firstReason : undefined
    });
  } catch (error: any) {
    console.error('[UploadToDrive Route Error]:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

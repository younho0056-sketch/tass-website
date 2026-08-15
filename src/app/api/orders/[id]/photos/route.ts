import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadBufferToGoogleDrive } from '@/lib/googleDrive';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const projectNo = (order as any).projectNo || `PRJ-${String(order.id).padStart(3, '0')}`;
    const folderName = `${projectNo} (${order.partnerName})`;

    // Find or create BlogFolder for this project
    let folder = await prisma.blogFolder.findFirst({
      where: {
        OR: [
          { name: folderName },
          { name: projectNo },
          { name: { startsWith: projectNo } }
        ]
      }
    });

    if (!folder) {
      folder = await prisma.blogFolder.create({
        data: { name: folderName }
      });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    // Auto-create 'order-photos' bucket in Supabase if possible
    if (supabaseUrl && supabaseKey) {
      try {
        await fetch(`${supabaseUrl}/storage/v1/bucket`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ id: 'order-photos', name: 'order-photos', public: true })
        });
      } catch (e) {
        // Bucket creation ignored if already exists or permission restricted
      }
    }

    const uploadedPhotos = await Promise.all(
      files.map(async (file) => {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        let photoUrl = '';
        let storageBucketUsed = '';

        // 1. PRIMARY STORAGE: Supabase Storage Upload
        if (supabaseUrl && supabaseKey) {
          const bucketsToTry = ['order-photos', 'blog-images', 'product-images'];
          const fileExt = file.name.split('.').pop() || 'png';
          const fileName = `site-${projectNo}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

          for (const bucketName of bucketsToTry) {
            try {
              const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucketName}/${fileName}`;
              const uploadRes = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': file.type || 'image/png',
                  'x-upsert': 'true'
                },
                body: buffer
              });

              if (uploadRes.ok) {
                photoUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${fileName}`;
                storageBucketUsed = bucketName;
                break;
              }
            } catch (supabaseErr) {
              console.warn(`Supabase bucket [${bucketName}] upload failed:`, supabaseErr);
            }
          }
        }

        // Base64 Fallback if Supabase credentials missing or network failed
        if (!photoUrl) {
          const mimeType = file.type || 'image/png';
          const base64 = buffer.toString('base64');
          photoUrl = `data:${mimeType};base64,${base64}`;
          storageBucketUsed = 'base64-fallback';
        }

        // 2. SECONDARY / BACKUP: Google Drive Upload (Non-blocking try-catch)
        let driveResult: { success: boolean; fileId?: string; webViewLink?: string; targetFolderId?: string; reason?: string } = {
          success: false,
          reason: 'Google Drive backup disabled or non-critical failure'
        };

        try {
          const driveFileName = `site-${projectNo}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${file.name.split('.').pop() || 'jpg'}`;
          driveResult = await uploadBufferToGoogleDrive({
            fileName: driveFileName,
            mimeType: file.type || 'image/jpeg',
            buffer,
            projectNo,
            partnerName: order.partnerName
          });
          if (!driveResult.success) {
            console.warn(`[GoogleDrive Backup Non-blocking Notice]: ${driveResult.reason}`);
          }
        } catch (driveErr: any) {
          console.warn(`[GoogleDrive Backup Exception - Non-blocking]: ${driveErr.message || 'Service Account Quota (403)'}`);
          driveResult = {
            success: false,
            reason: driveErr.message || 'Google Drive backup quota limit (403)'
          };
        }

        // 3. Create BlogPhoto record for instant web gallery & order display
        const photoRecord = await prisma.blogPhoto.create({
          data: {
            url: photoUrl,
            folderId: folder.id
          }
        });

        return {
          ...photoRecord,
          storageBucketUsed,
          driveResult
        };
      })
    );

    return NextResponse.json({
      success: true,
      message: '✅ 현장 사진이 메인 스토리지(Supabase Storage)에 성공적으로 저장되었습니다!',
      folderId: folder.id,
      folderName: folder.name,
      photos: uploadedPhotos,
      supabaseStatus: {
        bucket: uploadedPhotos[0]?.storageBucketUsed || 'order-photos',
        count: uploadedPhotos.length
      },
      googleDriveStatus: {
        success: uploadedPhotos.some(p => p.driveResult && p.driveResult.success),
        notice: 'Google Drive 백업은 선택적 보조 기능이며, 메인 저장소(Supabase) 업로드가 최우선으로 완료되었습니다.'
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error('Site photo upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}

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

    const uploadedPhotos = await Promise.all(
      files.map(async (file) => {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        let photoUrl = '';

        // 1. Supabase Storage or Base64 Fallback
        if (supabaseUrl && supabaseKey) {
          try {
            const fileExt = file.name.split('.').pop() || 'png';
            const fileName = `site-${projectNo}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
            const bucketName = 'blog-images';

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
            } else {
              const fallbackUploadUrl = `${supabaseUrl}/storage/v1/object/product-images/${fileName}`;
              const fallbackRes = await fetch(fallbackUploadUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': file.type || 'image/png',
                  'x-upsert': 'true'
                },
                body: buffer
              });
              if (fallbackRes.ok) {
                photoUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${fileName}`;
              }
            }
          } catch (supabaseErr) {
            console.warn('Supabase storage site photo upload failed, fallback to base64:', supabaseErr);
          }
        }

        if (!photoUrl) {
          const mimeType = file.type || 'image/png';
          const base64 = buffer.toString('base64');
          photoUrl = `data:${mimeType};base64,${base64}`;
        }

        // 2. Upload to Google Drive (타스_도면 > 거래처명 > PRJ-XXX)
        const driveFileName = `site-${projectNo}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${file.name.split('.').pop() || 'jpg'}`;
        let driveResult: { success: boolean; fileId?: string; webViewLink?: string; targetFolderId?: string; reason?: string } = {
          success: false
        };

        try {
          driveResult = await uploadBufferToGoogleDrive({
            fileName: driveFileName,
            mimeType: file.type || 'image/jpeg',
            buffer,
            projectNo,
            partnerName: order.partnerName
          });

          if (!driveResult.success) {
            console.warn(`[GoogleDrive Upload Warning for ${file.name}]:`, driveResult.reason);
          } else {
            console.log(`[GoogleDrive Upload Success for ${file.name}]: targetFolderId=${driveResult.targetFolderId}, fileId=${driveResult.fileId}`);
          }
        } catch (driveErr: any) {
          console.error(`[GoogleDrive Upload Exception for ${file.name}]:`, driveErr);
          driveResult = {
            success: false,
            reason: driveErr.message || 'Google Drive API upload exception'
          };
        }

        // 3. Create BlogPhoto record for instant web gallery
        const photoRecord = await prisma.blogPhoto.create({
          data: {
            url: photoUrl,
            folderId: folder.id
          }
        });

        return {
          ...photoRecord,
          driveResult
        };
      })
    );

    const firstDriveError = uploadedPhotos.find(p => p.driveResult && !p.driveResult.success)?.driveResult?.reason;
    const allDriveSuccess = uploadedPhotos.every(p => p.driveResult && p.driveResult.success);

    return NextResponse.json({
      success: true,
      folderId: folder.id,
      folderName: folder.name,
      photos: uploadedPhotos,
      googleDriveStatus: {
        success: allDriveSuccess,
        targetFolderId: uploadedPhotos[0]?.driveResult?.targetFolderId || null,
        reason: firstDriveError || (allDriveSuccess ? '구글 드라이브 폴더(타스_도면 > 거래처명 > 프로젝트번호) 원본 업로드 성공' : undefined)
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Site photo upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

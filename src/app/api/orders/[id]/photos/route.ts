import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadBufferToGoogleDrive } from '@/lib/googleDrive';

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

        // 2. Trigger Google Drive Upload in Background (non-blocking)
        const driveFileName = `site-${projectNo}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${file.name.split('.').pop() || 'jpg'}`;
        uploadBufferToGoogleDrive({
          fileName: driveFileName,
          mimeType: file.type || 'image/jpeg',
          buffer,
          projectNo
        }).catch(err => console.error('[Background Drive Upload Failed]:', err));

        // 3. Create BlogPhoto record for instant web gallery
        return prisma.blogPhoto.create({
          data: {
            url: photoUrl,
            folderId: folder.id
          }
        });
      })
    );

    return NextResponse.json({
      success: true,
      folderId: folder.id,
      folderName: folder.name,
      photos: uploadedPhotos
    }, { status: 201 });
  } catch (error) {
    console.error('Site photo upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

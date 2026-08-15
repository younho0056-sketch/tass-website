import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const folderId = parseInt(id, 10);
    if (isNaN(folderId)) {
      return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    // Auto-create 'order-photos' bucket if possible
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
        // Ignored if already exists
      }
    }

    const uploadedPhotos = await Promise.all(
      files.map(async (file) => {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        let photoUrl = '';

        // 1. Attempt Supabase Storage Upload
        if (supabaseUrl && supabaseKey) {
          const bucketsToTry = ['order-photos', 'blog-images', 'product-images'];
          const fileExt = file.name.split('.').pop() || 'png';
          const fileName = `blog-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

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
                break;
              }
            } catch (supabaseErr) {
              console.warn(`Supabase bucket ${bucketName} upload attempt failed:`, supabaseErr);
            }
          }
        }

        // 2. Persistent Storage Fallback (Data URL)
        if (!photoUrl) {
          const mimeType = file.type || 'image/png';
          const base64 = buffer.toString('base64');
          photoUrl = `data:${mimeType};base64,${base64}`;
        }

        return prisma.blogPhoto.create({
          data: {
            url: photoUrl,
            folderId: folderId
          }
        });
      })
    );

    return NextResponse.json(uploadedPhotos, { status: 201 });
  } catch (error) {
    console.error('Blog photo upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

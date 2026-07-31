import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 1. Supabase Storage Integration (if configured in environment variables)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const fileExt = file.name.split('.').pop() || 'png';
        const fileName = `product-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        const bucketName = 'product-images';

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
          const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${fileName}`;
          return NextResponse.json({ url: publicUrl, storageType: 'supabase' }, { status: 200 });
        }
      } catch (supabaseErr) {
        console.warn('Supabase storage upload attempt failed, using persistent fallback:', supabaseErr);
      }
    }

    // 2. Persistent Storage (Data URL conversion for serverless zero-disk loss)
    const mimeType = file.type || 'image/png';
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({ 
      url: dataUrl, 
      storageType: 'persistent-data-url' 
    }, { status: 200 });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}

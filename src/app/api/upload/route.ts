import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '업로드할 파일이 없습니다.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ 
        error: 'Supabase 스토리지 연결 환경변수(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)가 Vercel 대시보드에 설정되지 않았습니다.' 
      }, { status: 400 });
    }

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
    } else {
      const errText = await uploadRes.text();
      console.error('Supabase storage upload error:', uploadRes.status, errText);
      return NextResponse.json({ 
        error: `Supabase Storage ('product-images' 버킷) 업로드 실패 (${uploadRes.status}): ${errText || 'Supabase 대시보드에서 product-images 공개 버킷이 생성되어 있는지 확인하세요.'}` 
      }, { status: 500 });
    }
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error('File upload error:', errMessage);
    return NextResponse.json({ error: `파일 업로드 중 오류 발생: ${errMessage}` }, { status: 500 });
  }
}


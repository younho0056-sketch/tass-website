import { prisma } from '@/lib/prisma';

// 견적서 원본 파일 열기 (?download=1 이면 내려받기)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return new Response('잘못된 요청입니다.', { status: 400 });

  const file = await prisma.estimateFile.findUnique({
    where: { id },
    select: { fileName: true, mimeType: true, content: { select: { data: true } } },
  });
  if (!file || !file.content) return new Response('파일을 찾을 수 없습니다.', { status: 404 });

  const download = new URL(request.url).searchParams.get('download') === '1';
  const asciiName = file.fileName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  const disposition = `${download ? 'attachment' : 'inline'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`;

  return new Response(new Uint8Array(file.content.data), {
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': disposition,
      'Cache-Control': 'private, max-age=300',
    },
  });
}

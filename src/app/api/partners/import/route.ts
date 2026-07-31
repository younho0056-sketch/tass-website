import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as xlsx from 'xlsx';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parse Excel file
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    // Expected headers: 업체명, 구분, 분야, 담당자, 휴대폰, 팩스, 이메일, 주소, 비고
    interface ExcelRow {
      [key: string]: string | number | undefined;
    }
    const rawData = xlsx.utils.sheet_to_json<ExcelRow>(worksheet);

    const existingDbPartners = await prisma.partner.findMany({ select: { name: true } });
    const existingNameSet = new Set(existingDbPartners.map(p => p.name));
    const processedInBatch = new Set<string>();

    let successCount = 0;
    const duplicateNames: string[] = [];
    
    for (const row of rawData) {
      const name = row['업체명']?.toString().trim();
      if (!name) continue; // 업체명이 없으면 건너뜀

      if (existingNameSet.has(name) || processedInBatch.has(name)) {
        if (!duplicateNames.includes(name)) {
          duplicateNames.push(name);
        }
        continue; // 중복 입력을 차단하고 건너뜀
      }

      const type = row['구분']?.toString().trim() || '매출처';
      const specialty = row['분야']?.toString().trim() || '';
      const manager = row['담당자']?.toString().trim() || null;
      const phone = row['휴대폰']?.toString().trim() || null;
      const tel = row['회사전화']?.toString().trim() || row['전화번호']?.toString().trim() || null;
      const fax = row['팩스']?.toString().trim() || null;
      const email = row['이메일']?.toString().trim() || null;
      const address = row['주소']?.toString().trim() || null;
      const memo = row['비고']?.toString().trim() || null;

      await prisma.partner.create({
        data: {
          name, type, specialty, manager, phone, tel, fax, email, address, memo
        }
      });
      processedInBatch.add(name);
      successCount++;
    }

    return NextResponse.json({ 
      success: true, 
      count: successCount, 
      duplicateCount: duplicateNames.length,
      duplicateNames 
    }, { status: 200 });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 });
  }
}

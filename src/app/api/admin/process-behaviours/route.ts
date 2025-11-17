import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  console.log('🚀 [API] Starting behaviour files processing...');
  
  try {
    const formData = await request.formData();
    const home = formData.get('home') as string;
    const pdfCount = parseInt(formData.get('pdfCount') as string) || 0;
    const excelCount = parseInt(formData.get('excelCount') as string) || 0;
    
    console.log('📊 [API] Request parameters:', { home, pdfCount, excelCount });

    if (pdfCount === 0 || excelCount === 0 || !home) {
      console.error('❌ [API] Missing required files or home');
      return NextResponse.json({ error: 'Missing required files or home' }, { status: 400 });
    }

    const pdfFiles: File[] = [];
    for (let i = 0; i < pdfCount; i++) {
      const file = formData.get(`pdf_${i}`) as File;
      if (file) {
        pdfFiles.push(file);
        console.log(`📄 [API] Extracted PDF file ${i}: ${file.name}`);
      }
    }

    const excelFiles: File[] = [];
    for (let i = 0; i < excelCount; i++) {
      const file = formData.get(`excel_${i}`) as File;
      if (file) {
        excelFiles.push(file);
        console.log(`📊 [API] Extracted Excel file ${i}: ${file.name}`);
      }
    }

    const homeDir = join(process.cwd(), 'python', home);
    const downloadsDir = join(homeDir, 'downloads');

    console.log(`🏠 [API] Creating directories for home: ${home}`);
    await mkdir(downloadsDir, { recursive: true });
    console.log('✅ [API] Directories created');

    console.log(`💾 [API] Saving ${pdfFiles.length} PDF files and ${excelFiles.length} Excel files`);
    
    for (const file of pdfFiles) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const path = join(downloadsDir, file.name);
      await writeFile(path, Buffer.from(bytes));
      console.log(`✅ [API] Saved PDF: ${file.name}`);
    }
    
    for (const file of excelFiles) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const path = join(downloadsDir, file.name);
      await writeFile(path, Buffer.from(bytes));
      console.log(`✅ [API] Saved Excel: ${file.name}`);
    }

    console.log('✅ [API] All files saved successfully');

    console.log('🐍 [PYTHON] Installing required packages...');
    try {
      await execAsync(`python3 -m pip install --user --break-system-packages pdfplumber openai pandas python-dotenv openpyxl`);
      console.log('✅ [PYTHON] Packages installed successfully');
    } catch (pipErr) {
      console.log('⚠️ [PYTHON] Package installation warning:', pipErr);
    }

    console.log('🐍 [PYTHON] Step 1: Processing Excel data...');
    try {
      const excelResult = await execAsync(`cd "${homeDir}" && python3 getExcelInfo.py`);
      console.log('✅ [PYTHON] Excel processing completed');
      console.log('📊 [PYTHON] Excel output:', excelResult.stdout);
      if (excelResult.stderr) {
        console.log('⚠️ [PYTHON] Excel warnings:', excelResult.stderr);
      }
    } catch (error) {
      console.error('❌ [PYTHON] Excel processing failed:', error);
      throw error;
    }

    console.log('🐍 [PYTHON] Step 2: Processing PDF data...');
    try {
      const pdfResult = await execAsync(`cd "${homeDir}" && python3 getPdfInfo.py`);
      console.log('✅ [PYTHON] PDF processing completed');
      console.log('📊 [PYTHON] PDF output:', pdfResult.stdout);
      if (pdfResult.stderr) {
        console.log('⚠️ [PYTHON] PDF warnings:', pdfResult.stderr);
      }
    } catch (error) {
      console.error('❌ [PYTHON] PDF processing failed:', error);
      throw error;
    }

    console.log('🐍 [PYTHON] Step 3: Generating behaviour data...');
    try {
      const behaviourResult = await execAsync(`cd "${homeDir}" && python3 getBe.py`);
      console.log('✅ [PYTHON] Behaviour data generation completed');
      console.log('📊 [PYTHON] Behaviour output:', behaviourResult.stdout);
      if (behaviourResult.stderr) {
        console.log('⚠️ [PYTHON] Behaviour warnings:', behaviourResult.stderr);
      }
    } catch (error) {
      console.error('❌ [PYTHON] Behaviour data generation failed:', error);
      throw error;
    }
    console.log('🐍 [PYTHON] Step 4: Updating dashboard...');
    try {
      const dashboardResult = await execAsync(`cd "${homeDir}" && python3 update.py`);
      console.log('✅ [PYTHON] Dashboard updated successfully');
      console.log('📊 [PYTHON] Dashboard output:', dashboardResult.stdout);
      if (dashboardResult.stderr) {
        console.log('⚠️ [PYTHON] Dashboard warnings:', dashboardResult.stderr);
      }
    } catch (error) {
      console.error('❌ [PYTHON] Dashboard update failed:', error);
      throw error;
    }
    console.log('🐍 [PYTHON] Step 5: Uploading to dashboard...');
    try {
      const uploadResult = await execAsync(`cd "${homeDir}" && python3 upload_to_dashboard.py`);
      console.log('✅ [PYTHON] Dashboard uploaded successfully');
      console.log('📊 [PYTHON] Dashboard output:', uploadResult.stdout);
      if (uploadResult.stderr) {
        console.log('⚠️ [PYTHON] Dashboard warnings:', uploadResult.stderr);
      }
    } catch (error) {
      console.error('❌ [PYTHON] Dashboard upload failed:', error);
      throw error;
    }

    console.log('🎉 [API] File processing completed successfully!');

    return NextResponse.json({
      success: true,
      message: 'Files processed successfully',
      fileCounts: {
        pdfs: pdfFiles.length,
        excels: excelFiles.length
      }
    });

  } catch (error) {
    console.error('Error processing files:', error);
    return NextResponse.json(
      { error: 'Failed to process files', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


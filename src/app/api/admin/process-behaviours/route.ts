import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, stat, readdir } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { adminDb } from '@/lib/firebase-admin';
import { getFirebaseIdAsync, getPythonDirNameAsync, getHomeNameAsync, validateHomeMappingAsync } from '@/lib/homeMappings';

const execAsync = promisify(exec);

// Note: getAltName is no longer needed - we use getFirebaseIdAsync directly

export async function POST(request: NextRequest) {
  console.log('🚀 [API] Starting behaviour files processing...');
  
  try {
    const formData = await request.formData();
    const home = formData.get('home') as string;
    const pdfCount = parseInt(formData.get('pdfCount') as string) || 0;
    const excelCount = parseInt(formData.get('excelCount') as string) || 0;
    
    // Get overview metrics
    const antipsychoticsPercentage = formData.get('antipsychoticsPercentage') as string;
    const antipsychoticsChange = formData.get('antipsychoticsChange') as string;
    const antipsychoticsResidents = formData.get('antipsychoticsResidents') as string;
    
    const worsenedPercentage = formData.get('worsenedPercentage') as string;
    const worsenedChange = formData.get('worsenedChange') as string;
    const worsenedResidents = formData.get('worsenedResidents') as string;
    
    const improvedPercentage = formData.get('improvedPercentage') as string;
    const improvedChange = formData.get('improvedChange') as string;
    const improvedResidents = formData.get('improvedResidents') as string;
    
    console.log('📊 [API] Request parameters:', { home, pdfCount, excelCount, hasMetrics: !!(antipsychoticsPercentage || worsenedPercentage || improvedPercentage) });

    if (!home) {
      console.error('❌ [API] Missing home');
      return NextResponse.json({ error: 'Home is required' }, { status: 400 });
    }

    // Validate home mapping exists (check Firebase)
    const validation = await validateHomeMappingAsync(home);
    if (!validation.valid) {
      console.error(`❌ [API] Invalid home mapping for: ${home}`, validation.missing);
      return NextResponse.json({ 
        error: `Home mapping not configured properly. Missing: ${validation.missing?.join(', ')}. Please ensure the home was created through the admin UI.` 
      }, { status: 400 });
    }

    // If no files, we can still save metrics
    const hasFiles = pdfCount > 0 && excelCount > 0;
    const hasMetrics = !!(antipsychoticsPercentage || worsenedPercentage || improvedPercentage);
    
    // If no files and no metrics, that's okay - just return success (preserves existing values)
    if (!hasFiles && !hasMetrics) {
      return NextResponse.json({
        success: true,
        message: 'No changes made - existing values preserved',
        metricsSaved: false
      });
    }

    // Save metrics to Firebase if provided (if not provided, existing values are preserved)
    if (hasMetrics) {
      const altName = await getFirebaseIdAsync(home);
      const metricsRef = adminDb.ref(`/${altName}/overviewMetrics`);
      
      const metricsData: any = {};
      
      if (antipsychoticsPercentage) {
        metricsData.antipsychotics = {
          percentage: parseInt(antipsychoticsPercentage) || 0,
          change: parseInt(antipsychoticsChange || '0') || 0,
          residents: antipsychoticsResidents ? antipsychoticsResidents.split(',').map(r => r.trim()).filter(r => r) : []
        };
      }
      
      if (worsenedPercentage) {
        metricsData.worsened = {
          percentage: parseInt(worsenedPercentage) || 0,
          change: parseInt(worsenedChange || '0') || 0,
          residents: worsenedResidents ? worsenedResidents.split(',').map(r => r.trim()).filter(r => r) : []
        };
      }
      
      if (improvedPercentage) {
        metricsData.improved = {
          percentage: parseInt(improvedPercentage) || 0,
          change: parseInt(improvedChange || '0') || 0,
          residents: improvedResidents ? improvedResidents.split(',').map(r => r.trim()).filter(r => r) : []
        };
      }
      
      // Get existing metrics to preserve values not being updated
      const existingSnapshot = await metricsRef.once('value');
      const existingData = existingSnapshot.exists() ? existingSnapshot.val() : {};
      
      // Merge existing data with new data (only update provided metrics)
      const mergedData = {
        ...existingData,
        ...metricsData
      };
      
      await metricsRef.set(mergedData);
      console.log('✅ [API] Metrics saved to Firebase');
    }

    // If no files, return early after saving metrics
    if (!hasFiles) {
      return NextResponse.json({
        success: true,
        message: 'Metrics saved successfully',
        metricsSaved: true
      });
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

    const pythonDirName = await getPythonDirNameAsync(home);
    const homeNameForPython = await getHomeNameAsync(home);
    const homeDir = join(process.cwd(), 'python', pythonDirName);
    const downloadsDir = join(homeDir, 'downloads');
    
    console.log(`🏠 [API] Home mapping - UI: ${home}, Python Dir: ${pythonDirName}, Home Name: ${homeNameForPython}`);

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
    const excelStartTime = Date.now();
    try {
      // Check for Excel files before processing
      try {
        const excelFiles = await readdir(downloadsDir);
        const xlsFiles = excelFiles.filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));
        console.log(`📋 [PYTHON] Found ${xlsFiles.length} Excel file(s) to process:`, xlsFiles);
        for (const file of xlsFiles) {
          try {
            const filePath = join(downloadsDir, file);
            const stats = await stat(filePath);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`   📄 ${file} (${fileSizeMB} MB)`);
          } catch (err) {
            console.log(`   ⚠️ Could not get stats for ${file}`);
          }
        }
      } catch (err) {
        console.log('⚠️ [PYTHON] Could not list Excel files:', err);
      }

      console.log(`🔧 [PYTHON] Executing: cd "${homeDir}" && HOME_NAME="${homeNameForPython}" python3 getExcelInfo.py`);
      console.log(`📁 [PYTHON] Working directory: ${homeDir}`);
      console.log(`🏠 [PYTHON] Home name: ${homeNameForPython}`);
      
      const excelResult = await execAsync(`cd "${homeDir}" && HOME_NAME="${homeNameForPython}" python3 getExcelInfo.py`);
      const excelDuration = ((Date.now() - excelStartTime) / 1000).toFixed(2);
      console.log(`✅ [PYTHON] Excel processing completed in ${excelDuration}s`);
      console.log('📊 [PYTHON] Excel output:', excelResult.stdout);
      if (excelResult.stderr) {
        console.log('⚠️ [PYTHON] Excel warnings:', excelResult.stderr);
      }
    } catch (error) {
      const excelDuration = ((Date.now() - excelStartTime) / 1000).toFixed(2);
      console.error(`❌ [PYTHON] Excel processing failed after ${excelDuration}s:`, error);
      if (error instanceof Error) {
        console.error('❌ [PYTHON] Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      throw error;
    }

    console.log('🐍 [PYTHON] Step 2: Processing PDF data...');
    const pdfStartTime = Date.now();
    try {
      // Check for PDF files before processing
      try {
        const pdfFiles = await readdir(downloadsDir);
        const pdfFileList = pdfFiles.filter(f => f.endsWith('.pdf'));
        console.log(`📋 [PYTHON] Found ${pdfFileList.length} PDF file(s) to process:`, pdfFileList);
        let totalSizeMB = 0;
        for (const file of pdfFileList) {
          try {
            const filePath = join(downloadsDir, file);
            const stats = await stat(filePath);
            const fileSizeMB = stats.size / (1024 * 1024);
            totalSizeMB += fileSizeMB;
            console.log(`   📄 ${file} (${fileSizeMB.toFixed(2)} MB)`);
          } catch (err) {
            console.log(`   ⚠️ Could not get stats for ${file}`);
          }
        }
        console.log(`📊 [PYTHON] Total PDF size: ${totalSizeMB.toFixed(2)} MB`);
        console.log(`⏱️ [PYTHON] PDF processing can take 1-5 minutes per MB depending on content complexity...`);
      } catch (err) {
        console.log('⚠️ [PYTHON] Could not list PDF files:', err);
      }

      console.log(`🔧 [PYTHON] Executing: cd "${homeDir}" && HOME_NAME="${homeNameForPython}" python3 getPdfInfo.py`);
      console.log(`📁 [PYTHON] Working directory: ${homeDir}`);
      console.log(`🏠 [PYTHON] Home name: ${homeNameForPython}`);
      console.log(`⏳ [PYTHON] Starting PDF processing at ${new Date().toISOString()}...`);
      console.log(`💡 [PYTHON] This step involves text extraction and AI processing, which can take several minutes...`);
      
      const pdfResult = await execAsync(`cd "${homeDir}" && HOME_NAME="${homeNameForPython}" python3 getPdfInfo.py`);
      const pdfDuration = ((Date.now() - pdfStartTime) / 1000).toFixed(2);
      const pdfDurationMinutes = (parseFloat(pdfDuration) / 60).toFixed(2);
      console.log(`✅ [PYTHON] PDF processing completed in ${pdfDuration}s (${pdfDurationMinutes} minutes)`);
      console.log(`📊 [PYTHON] PDF output (first 1000 chars):`, pdfResult.stdout.substring(0, 1000));
      if (pdfResult.stdout.length > 1000) {
        console.log(`📊 [PYTHON] ... (output truncated, total length: ${pdfResult.stdout.length} chars)`);
      }
      if (pdfResult.stderr) {
        console.log('⚠️ [PYTHON] PDF warnings/stderr:', pdfResult.stderr);
      }
    } catch (error) {
      const pdfDuration = ((Date.now() - pdfStartTime) / 1000).toFixed(2);
      const pdfDurationMinutes = (parseFloat(pdfDuration) / 60).toFixed(2);
      console.error(`❌ [PYTHON] PDF processing failed after ${pdfDuration}s (${pdfDurationMinutes} minutes)`);
      if (error instanceof Error) {
        console.error('❌ [PYTHON] Error details:', {
          message: error.message,
          stack: error.stack
        });
        // Check if it's a timeout or process issue
        if (error.message.includes('killed') || error.message.includes('SIGTERM')) {
          console.error('❌ [PYTHON] Process was killed - possible timeout or resource issue');
        }
        if (error.message.includes('ENOENT')) {
          console.error('❌ [PYTHON] File or directory not found - check Python script path');
        }
      }
      throw error;
    }

    console.log('🐍 [PYTHON] Step 3: Generating behaviour data...');
    const behaviourStartTime = Date.now();
    try {
      console.log(`🔧 [PYTHON] Executing: cd "${homeDir}" && HOME_NAME="${homeNameForPython}" python3 getBe.py`);
      const behaviourResult = await execAsync(`cd "${homeDir}" && HOME_NAME="${homeNameForPython}" python3 getBe.py`);
      const behaviourDuration = ((Date.now() - behaviourStartTime) / 1000).toFixed(2);
      console.log(`✅ [PYTHON] Behaviour data generation completed in ${behaviourDuration}s`);
      console.log('📊 [PYTHON] Behaviour output:', behaviourResult.stdout);
      if (behaviourResult.stderr) {
        console.log('⚠️ [PYTHON] Behaviour warnings:', behaviourResult.stderr);
      }
    } catch (error) {
      const behaviourDuration = ((Date.now() - behaviourStartTime) / 1000).toFixed(2);
      console.error(`❌ [PYTHON] Behaviour data generation failed after ${behaviourDuration}s:`, error);
      if (error instanceof Error) {
        console.error('❌ [PYTHON] Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      throw error;
    }
    console.log('🐍 [PYTHON] Step 4: Updating dashboard...');
    const updateStartTime = Date.now();
    try {
      console.log(`🔧 [PYTHON] Executing: cd "${homeDir}" && python3 update.py`);
      const dashboardResult = await execAsync(`cd "${homeDir}" && python3 update.py`);
      const updateDuration = ((Date.now() - updateStartTime) / 1000).toFixed(2);
      console.log(`✅ [PYTHON] Dashboard updated successfully in ${updateDuration}s`);
      console.log('📊 [PYTHON] Dashboard output:', dashboardResult.stdout);
      if (dashboardResult.stderr) {
        console.log('⚠️ [PYTHON] Dashboard warnings:', dashboardResult.stderr);
      }
    } catch (error) {
      const updateDuration = ((Date.now() - updateStartTime) / 1000).toFixed(2);
      console.error(`❌ [PYTHON] Dashboard update failed after ${updateDuration}s:`, error);
      if (error instanceof Error) {
        console.error('❌ [PYTHON] Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      throw error;
    }
    console.log('🐍 [PYTHON] Step 5: Uploading to dashboard...');
    const uploadStartTime = Date.now();
    try {
      console.log(`🔧 [PYTHON] Executing: cd "${homeDir}" && python3 upload_to_dashboard.py`);
      const uploadResult = await execAsync(`cd "${homeDir}" && python3 upload_to_dashboard.py`);
      const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
      console.log(`✅ [PYTHON] Dashboard uploaded successfully in ${uploadDuration}s`);
      console.log('📊 [PYTHON] Dashboard output:', uploadResult.stdout);
      if (uploadResult.stderr) {
        console.log('⚠️ [PYTHON] Dashboard warnings:', uploadResult.stderr);
      }
    } catch (error) {
      const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
      console.error(`❌ [PYTHON] Dashboard upload failed after ${uploadDuration}s:`, error);
      if (error instanceof Error) {
        console.error('❌ [PYTHON] Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      throw error;
    }

    console.log('🎉 [API] File processing completed successfully!');

    return NextResponse.json({
      success: true,
      message: 'Files processed successfully' + (hasMetrics ? ' and metrics saved' : ''),
      fileCounts: {
        pdfs: pdfFiles.length,
        excels: excelFiles.length
      },
      metricsSaved: hasMetrics
    });

  } catch (error) {
    console.error('Error processing files:', error);
    return NextResponse.json(
      { error: 'Failed to process files', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


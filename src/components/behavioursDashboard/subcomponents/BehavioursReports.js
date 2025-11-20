  'use client';

  import React, { useEffect, useState, useRef } from 'react';
  import styles from '@/styles/Behaviours.module.css';
  import { Bar } from 'react-chartjs-2';
  import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
  } from 'chart.js';
  import html2canvas from 'html2canvas';
  import jsPDF from 'jspdf';
  // Import jspdf-autotable as side effect to register the plugin
  import 'jspdf-autotable';
  // Import Inter font helper
  import { getInterFontName, registerInterFont } from '@/lib/inter-font';

  ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
  );

  export default function BehavioursReports({ name, altName, data, getTimeOfDay, startDate, endDate }) {
    const [selectedHome, setSelectedHome] = useState(name);
    const [selectedUnits, setSelectedUnits] = useState([]);
    const [selectedResidents, setSelectedResidents] = useState([]);
    const [allReportsData, setAllReportsData] = useState({});
    const [loading, setLoading] = useState(false);
    const [availableUnits, setAvailableUnits] = useState([]);
    const [availableResidents, setAvailableResidents] = useState([]);
    const chartRefs = useRef({});
    const reportContentRef = useRef(null);

    // Extract available units and residents from data
    useEffect(() => {
      if (data && data.length > 0) {
        const units = [...new Set(data.map(item => item.room || item.homeUnit).filter(Boolean))];
        const residents = [...new Set(data.map(item => item.name).filter(Boolean))];
        setAvailableUnits(units.sort());
        setAvailableResidents(residents.sort());
      }
    }, [data]);

    // Fetch all report data when filters change
    useEffect(() => {
      if (startDate && endDate) {
        fetchAllReportsData();
      }
    }, [selectedHome, selectedUnits, selectedResidents, startDate, endDate, data]);

    // Helper function to clean duplicated text
    const cleanDuplicatedText = (text) => {
      if (!text) return text;
      // Remove multiple occurrences of "Within 24hrs of RIM" after "No Progress Note Found Within 24hrs of RIM"
      let cleaned = text.replace(/No Progress Note Found Within 24hrs of RIM\s*(?:Within 24hrs of RIM\s*)+/gi, 'No Progress Note Found Within 24hrs of RIM');
      // Also remove multiple standalone occurrences of "Within 24hrs of RIM"
      cleaned = cleaned.replace(/(Within 24hrs of RIM\s*){2,}/gi, 'Within 24hrs of RIM');
      return cleaned.trim();
    };

    const fetchAllReportsData = async () => {
      setLoading(true);
      try {
        // Filter data based on selected criteria
        let filteredData = [...(data || [])];

        // Filter by date range
        if (startDate && endDate) {
          filteredData = filteredData.filter(item => {
            if (!item.date) return false;
            const itemDate = new Date(item.date);
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            return itemDate >= start && itemDate <= end;
          });
        }

        // Filter by units
        if (selectedUnits.length > 0) {
          filteredData = filteredData.filter(item => {
            const unit = item.room || item.homeUnit;
            return unit && selectedUnits.includes(unit);
          });
        }

        // Filter by residents
        if (selectedResidents.length > 0) {
          filteredData = filteredData.filter(item => 
            item.name && selectedResidents.includes(item.name)
          );
        }

        // Generate all reports
        const reportTypes = ['timeOfDay', 'behaviourType', 'behaviourBreakdown', 'resident', 'unit', 'hour'];
        const allReports = {};
        
        reportTypes.forEach(type => {
          allReports[type] = generateReport(filteredData, type);
        });
        
        setAllReportsData(allReports);
      } catch (error) {
        console.error('Error fetching report data:', error);
      } finally {
        setLoading(false);
      }
    };

    const generateReport = (filteredData, type) => {
      const totalEvents = filteredData.length;
      const residentsAffected = new Set(filteredData.map(item => item.name).filter(Boolean)).size;
      const unitsInvolved = new Set(filteredData.map(item => item.room || item.homeUnit).filter(Boolean)).size;

      let chartLabels = [];
      let chartValues = [];
      let tableData = [];

      switch (type) {
        case 'timeOfDay':
          const timeOfDayCounts = { Morning: 0, Evening: 0, Night: 0 };
          filteredData.forEach(item => {
            const timeOfDay = getTimeOfDay(item.time);
            if (timeOfDay === 'Morning' || timeOfDay === 'Evening' || timeOfDay === 'Night') {
              timeOfDayCounts[timeOfDay]++;
            }
          });
          chartLabels = ['Morning', 'Evening', 'Night'];
          chartValues = [timeOfDayCounts.Morning, timeOfDayCounts.Evening, timeOfDayCounts.Night];
          tableData = chartLabels.map((label, idx) => ({
            label,
            count: chartValues[idx],
            percentage: totalEvents > 0 ? ((chartValues[idx] / totalEvents) * 100).toFixed(1) : '0.0'
          }));
          break;

        case 'behaviourType':
          const typeCounts = {};
          filteredData.forEach(item => {
            const type = item.incident_type || item.behaviour_type || 'Unknown';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
          });
          const sortedTypes = Object.entries(typeCounts).sort(([,a], [,b]) => b - a);
          chartLabels = sortedTypes.map(([label]) => label);
          chartValues = sortedTypes.map(([,count]) => count);
          tableData = chartLabels.map((label, idx) => ({
            label,
            count: chartValues[idx],
            percentage: totalEvents > 0 ? ((chartValues[idx] / totalEvents) * 100).toFixed(1) : '0.0'
          }));
          break;

        case 'behaviourBreakdown':
          const breakdownCounts = {};
          filteredData.forEach(item => {
            const category = item.behaviour_type || item.incident_type || 'Unknown';
            const subtype = item.behaviour_subtype || item.behaviourCategory || '';
            // Use subtype directly if it exists, otherwise use category
            // This avoids duplication when subtype already contains the full text
            let key = subtype || category;
            // Clean any duplicated text patterns
            key = cleanDuplicatedText(key);
            breakdownCounts[key] = (breakdownCounts[key] || 0) + 1;
          });
          const sortedBreakdown = Object.entries(breakdownCounts).sort(([,a], [,b]) => b - a);
          chartLabels = sortedBreakdown.map(([label]) => cleanDuplicatedText(label));
          chartValues = sortedBreakdown.map(([,count]) => count);
          tableData = chartLabels.map((label, idx) => ({
            label,
            count: chartValues[idx],
            percentage: totalEvents > 0 ? ((chartValues[idx] / totalEvents) * 100).toFixed(1) : '0.0'
          }));
          break;

        case 'resident':
          const residentCounts = {};
          filteredData.forEach(item => {
            const resident = item.name || 'Unknown';
            residentCounts[resident] = (residentCounts[resident] || 0) + 1;
          });
          const sortedResidents = Object.entries(residentCounts).sort(([,a], [,b]) => b - a);
          chartLabels = sortedResidents.map(([label]) => label);
          chartValues = sortedResidents.map(([,count]) => count);
          tableData = chartLabels.map((label, idx) => ({
            label,
            count: chartValues[idx],
            percentage: totalEvents > 0 ? ((chartValues[idx] / totalEvents) * 100).toFixed(1) : '0.0'
          }));
          break;

        case 'unit':
          const unitCounts = {};
          filteredData.forEach(item => {
            const unit = item.room || item.homeUnit || 'Unknown';
            unitCounts[unit] = (unitCounts[unit] || 0) + 1;
          });
          const sortedUnits = Object.entries(unitCounts).sort(([,a], [,b]) => b - a);
          chartLabels = sortedUnits.map(([label]) => label);
          chartValues = sortedUnits.map(([,count]) => count);
          tableData = chartLabels.map((label, idx) => ({
            label,
            count: chartValues[idx],
            percentage: totalEvents > 0 ? ((chartValues[idx] / totalEvents) * 100).toFixed(1) : '0.0'
          }));
          break;

        case 'hour':
          const hourCounts = Array(24).fill(0);
          filteredData.forEach(item => {
            if (item.time) {
              const hour = parseInt(item.time.split(':')[0], 10);
              if (!isNaN(hour) && hour >= 0 && hour <= 23) {
                hourCounts[hour]++;
              }
            }
          });
          chartLabels = Array.from({length: 24}, (_, i) => `${i}:00`);
          chartValues = hourCounts;
          tableData = chartLabels.map((label, idx) => ({
            label,
            count: chartValues[idx],
            percentage: totalEvents > 0 ? ((chartValues[idx] / totalEvents) * 100).toFixed(1) : '0.0'
          }));
          break;

        default:
          break;
      }

      return {
        summary: {
          totalEvents,
          residentsAffected,
          unitsInvolved
        },
        chart: {
          labels: chartLabels,
          values: chartValues
        },
        table: tableData
      };
    };

    const handleExportPDF = async () => {
      if (!reportContentRef.current || Object.keys(allReportsData).length === 0) return;

      // Ensure jspdf-autotable is loaded
      if (typeof window !== 'undefined') {
        await import('jspdf-autotable');
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
      });

      // Register Inter font (will use helvetica if not configured)
      registerInterFont(pdf);
      const fontName = getInterFontName(pdf); // Returns 'Inter' or 'helvetica'

      const pageWidth = pdf.internal.pageSize.width;
      const pageHeight = pdf.internal.pageSize.height;
      let yPosition = 0;

      // Add colored header banner
      pdf.setFillColor(6, 182, 212); // Cyan blue color
      pdf.rect(0, yPosition, pageWidth, 60, 'F');
      yPosition = 40;
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(28);
      pdf.setFont(fontName, 'bold');
      pdf.text('Behaviours Analysis Report', pageWidth / 2, yPosition, { align: 'center' });
      yPosition = 80;

      // Add report parameters
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(14);
      pdf.setFont(fontName, 'normal');
      pdf.text(`Facility: ${selectedHome}`, 20, yPosition);
      yPosition += 20;
      
      const startDateFormatted = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const endDateFormatted = new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      pdf.text(`Period: ${startDateFormatted} to ${endDateFormatted}`, 20, yPosition);
      yPosition += 30;

      // Add summary statistics section with cards
      const firstReport = Object.values(allReportsData)[0];
      if (firstReport) {
        pdf.setFontSize(18);
        pdf.setFont(fontName, 'bold');
        pdf.text('Summary Statistics', 20, yPosition);
        yPosition += 30;

        // Create 2x2 grid of summary cards
        const cardWidth = (pageWidth - 60) / 2;
        const cardHeight = 80;
        const cardSpacing = 20;
        const startX = 20;

        // Top row
        // Card 1: Total Events
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(200, 200, 200);
        pdf.rect(startX, yPosition, cardWidth, cardHeight, 'FD');
        pdf.setFontSize(12);
        pdf.setFont(fontName, 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text('Total Incidents', startX + 15, yPosition + 20);
        pdf.setFontSize(24);
        pdf.setFont(fontName, 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(firstReport.summary.totalEvents.toString(), startX + 15, yPosition + 50);

        // Card 2: Residents Affected
        pdf.setFillColor(255, 255, 255);
        pdf.rect(startX + cardWidth + cardSpacing, yPosition, cardWidth, cardHeight, 'FD');
        pdf.setFontSize(12);
        pdf.setFont(fontName, 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text('Residents Affected', startX + cardWidth + cardSpacing + 15, yPosition + 20);
        pdf.setFontSize(24);
        pdf.setFont(fontName, 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(firstReport.summary.residentsAffected.toString(), startX + cardWidth + cardSpacing + 15, yPosition + 50);

        yPosition += cardHeight + cardSpacing;

        // Bottom row
        // Card 3: Locations Involved
        pdf.setFillColor(255, 255, 255);
        pdf.rect(startX, yPosition, cardWidth, cardHeight, 'FD');
        pdf.setFontSize(12);
        pdf.setFont(fontName, 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text('Locations Involved', startX + 15, yPosition + 20);
        pdf.setFontSize(24);
        pdf.setFont(fontName, 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(firstReport.summary.unitsInvolved.toString(), startX + 15, yPosition + 50);

        // Card 4: Homes Affected
        pdf.setFillColor(255, 255, 255);
        pdf.rect(startX + cardWidth + cardSpacing, yPosition, cardWidth, cardHeight, 'FD');
        pdf.setFontSize(12);
        pdf.setFont(fontName, 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text('Homes Affected', startX + cardWidth + cardSpacing + 15, yPosition + 20);
        pdf.setFontSize(24);
        pdf.setFont(fontName, 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text('1', startX + cardWidth + cardSpacing + 15, yPosition + 50);

        yPosition += cardHeight + 40;
      }

      // Add all reports - ensure each section (title + chart + table) stays together
      const reportTypes = ['timeOfDay', 'behaviourType', 'behaviourBreakdown', 'resident', 'unit', 'hour'];
      
      for (const reportType of reportTypes) {
        const reportData = allReportsData[reportType];
        if (!reportData) continue;

        // Check if we need a new page - ensure entire section fits
        // Estimate space needed: title (30px) + chart (300px) + table header (30px) + table rows (20px per row)
        const estimatedSpace = 30 + 300 + 30 + (reportData.table?.length || 0) * 20;
        if (yPosition + estimatedSpace > pageHeight - 40) {
          pdf.addPage();
          yPosition = 20;
        }

        // Add report type header
        pdf.setFontSize(20);
        pdf.setFont(fontName, 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(getReportTypeLabel(reportType), 20, yPosition);
        yPosition += 10;
        
        // Add subtitle
        pdf.setFontSize(12);
        pdf.setFont(fontName, 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Behaviours by ${getReportTypeLabel(reportType).toLowerCase()}`, 20, yPosition);
        yPosition += 25;

        // Capture chart
        if (chartRefs.current[reportType]) {
          try {
            const chartCanvas = await html2canvas(chartRefs.current[reportType], {
              scale: 3, // Increased from 2 to 3 for larger text in charts
              backgroundColor: '#ffffff'
            });
            const chartImg = chartCanvas.toDataURL('image/png');
            // Reduce chart width - make it narrower and centered
            const chartWidth = (pageWidth - 120); // Reduced from pageWidth - 40
            const chartX = (pageWidth - chartWidth) / 2; // Center the chart
            const chartHeight = (chartCanvas.height * chartWidth) / chartCanvas.width;
            
            // If chart doesn't fit, move to next page
            if (yPosition + chartHeight + 20 > pageHeight - 200) {
              pdf.addPage();
              yPosition = 20;
              // Re-add title on new page
              pdf.setFontSize(20);
              pdf.setFont(fontName, 'bold');
              pdf.setTextColor(0, 0, 0);
              pdf.text(getReportTypeLabel(reportType), 20, yPosition);
              yPosition += 10;
              pdf.setFontSize(12);
              pdf.setFont(fontName, 'normal');
              pdf.setTextColor(100, 100, 100);
              pdf.text(`Behaviours by ${getReportTypeLabel(reportType).toLowerCase()}`, 20, yPosition);
              yPosition += 25;
            }
            
            // Add rounded border around chart
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(1);
            pdf.roundedRect(chartX - 5, yPosition - 5, chartWidth + 10, chartHeight + 10, 8, 8, 'S');
            
            pdf.addImage(chartImg, 'PNG', chartX, yPosition, chartWidth, chartHeight);
            yPosition += chartHeight + 30;
          } catch (error) {
            console.error('Error capturing chart:', error);
          }
        }

        // Add table
        if (reportData.table && reportData.table.length > 0) {
          // Check if table fits, if not move to next page
          const tableHeight = 30 + (reportData.table.length * 20);
          if (yPosition + tableHeight > pageHeight - 40) {
            pdf.addPage();
            yPosition = 20;
            // Re-add title on new page
            pdf.setFontSize(20);
            pdf.setFont(fontName, 'bold');
            pdf.setTextColor(0, 0, 0);
            pdf.text(getReportTypeLabel(reportType), 20, yPosition);
            yPosition += 10;
            pdf.setFontSize(12);
            pdf.setFont(fontName, 'normal');
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Behaviours by ${getReportTypeLabel(reportType).toLowerCase()}`, 20, yPosition);
            yPosition += 25;
          }

          pdf.setFontSize(16);
          pdf.setFont(fontName, 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text('Detailed ' + getReportTypeLabel(reportType) + ' Data', 20, yPosition);
          yPosition += 20;

          const tableData = reportData.table.map(row => [
            row.label,
            row.count.toString(),
            `${row.percentage}%`
          ]);

          // Check if autoTable is available
          if (typeof pdf.autoTable === 'function') {
            // Calculate narrower table width and center it
            const tableWidth = pageWidth - 120; // Reduced width
            const tableX = (pageWidth - tableWidth) / 2; // Center the table
            
            // Calculate column widths: Category gets more space, Count and Percentage are closer together
            const categoryWidth = tableWidth * 0.65; // 65% for Category
            const countWidth = tableWidth * 0.15; // 15% for Count
            const percentageWidth = tableWidth * 0.20; // 20% for Percentage
            
            pdf.autoTable({
              startY: yPosition,
              head: [['Category', 'Count', 'Percentage']],
              body: tableData,
              theme: 'striped',
              margin: { left: tableX, right: tableX },
              columnStyles: {
                0: { cellWidth: categoryWidth, overflow: 'linebreak' }, // Category - allow text wrapping
                1: { cellWidth: countWidth, halign: 'center' }, // Count - centered
                2: { cellWidth: percentageWidth, halign: 'center' } // Percentage - centered
              },
              headStyles: { 
                fillColor: [6, 182, 212], // Cyan blue header to match banner
                fontSize: 11, // Reduced font size
                fontStyle: 'bold',
                textColor: [255, 255, 255]
              },
              styles: { 
                fontSize: 11, // Reduced from 13 to 11
                font: fontName, // Use Inter font if registered, otherwise helvetica
                cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
                overflow: 'linebreak',
                cellWidth: 'wrap'
              },
              alternateRowStyles: {
                fillColor: [245, 245, 245]
              },
              tableWidth: tableWidth,
              showHead: 'everyPage'
            });
            
            // Add rounded border around table
            const tableEndY = pdf.lastAutoTable ? pdf.lastAutoTable.finalY : yPosition + (tableData.length * 20) + 30;
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(1);
            pdf.roundedRect(tableX - 5, yPosition - 5, tableWidth + 10, tableEndY - yPosition + 10, 8, 8, 'S');
            
            yPosition = tableEndY + 30;
          } else {
            // Fallback: manually create table
            const tableWidth = pageWidth - 120; // Reduced width
            const tableX = (pageWidth - tableWidth) / 2; // Center the table
            const cellHeight = 18; // Slightly increased for better spacing
            
            // Column widths: Category gets more space, Count and Percentage are closer
            const categoryWidth = tableWidth * 0.65;
            const countWidth = tableWidth * 0.15;
            const percentageWidth = tableWidth * 0.20;
            
            let currentY = yPosition;
            
            // Add border around table
            const tableStartY = currentY;
            
            // Header
            pdf.setFillColor(6, 182, 212); // Cyan blue to match banner
            pdf.rect(tableX, currentY, tableWidth, cellHeight, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(11); // Reduced font size
            pdf.setFont(fontName, 'bold');
            pdf.text('Category', tableX + 5, currentY + 12);
            pdf.text('Count', tableX + categoryWidth + (countWidth / 2) - 10, currentY + 12, { align: 'center' });
            pdf.text('Percentage', tableX + categoryWidth + countWidth + (percentageWidth / 2) - 15, currentY + 12, { align: 'center' });
            currentY += cellHeight;
            
            // Rows
            pdf.setTextColor(0, 0, 0);
            pdf.setFont(fontName, 'normal');
            pdf.setFontSize(11); // Reduced font size
            tableData.forEach((row, idx) => {
              if (idx % 2 === 1) {
                pdf.setFillColor(240, 240, 240);
                pdf.rect(tableX, currentY, tableWidth, cellHeight, 'F');
              }
              
              // Category - handle long text by truncating if needed
              const categoryText = row[0];
              const maxCategoryWidth = categoryWidth - 10;
              // Truncate text if it's too long (rough estimate: ~50 chars per line at 11px font)
              let displayText = categoryText;
              if (categoryText.length > 50) {
                displayText = categoryText.substring(0, 47) + '...';
              }
              pdf.text(displayText, tableX + 5, currentY + 12, { 
                maxWidth: maxCategoryWidth
              });
              
              // Count - centered
              pdf.text(row[1], tableX + categoryWidth + (countWidth / 2), currentY + 12, { align: 'center' });
              
              // Percentage - centered
              pdf.text(row[2], tableX + categoryWidth + countWidth + (percentageWidth / 2), currentY + 12, { align: 'center' });
              
              currentY += cellHeight;
            });
            
            // Draw rounded border around table
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(1);
            pdf.roundedRect(tableX - 5, tableStartY - 5, tableWidth + 10, currentY - tableStartY + 10, 8, 8, 'S');
            
            yPosition = currentY + 30;
          }
        }

        // Add spacing between reports
        yPosition += 40;
      }

      // Save PDF
      const filename = `behaviours-report-all-${startDate}-${endDate}.pdf`;
      pdf.save(filename);
    };

    const getReportTypeLabel = (type) => {
      const labels = {
        timeOfDay: 'Time of Day',
        behaviourType: 'Behaviour Type',
        behaviourBreakdown: 'Behaviour Breakdown',
        resident: 'Resident Name',
        unit: 'Unit',
        hour: 'By Hour (24hr)'
      };
      return labels[type] || type;
    };


    return (
      <div className={styles.dashboard} style={{ padding: '0', width: '100%', overflowX: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div ref={reportContentRef} style={{ width: '100%', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Header Section - Title on left, Filters on right */}
          <div style={{ 
            backgroundColor: '#fff', 
            borderBottom: '1px solid #e5e7eb',
            padding: '12px 30px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            width: '100%',
            boxSizing: 'border-box',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            flexShrink: 0
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap',
              width: '100%',
              maxWidth: '100%'
            }}>
              {/* Title on Left */}
              <div>
                <h1 style={{ 
                  fontSize: '22px', 
                  fontWeight: '700', 
                  color: '#111827',
                  margin: '0',
                  lineHeight: '1.2'
                }}>
                  Reports
                </h1>
              </div>

              {/* Filters on Right */}
              <div style={{ 
                display: 'flex', 
                gap: '10px', 
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                {/* Home Selector */}
                <select 
                  className={styles.selector}
                  value={selectedHome}
                  onChange={(e) => setSelectedHome(e.target.value)}
                  style={{ width: '140px', padding: '6px 32px 6px 12px', height: '36px' }}
                >
                  <option value={name}>{name}</option>
                </select>

                {/* Unit Selector */}
                <select 
                  className={styles.selector}
                  value={selectedUnits.length > 0 ? selectedUnits[0] : ''}
                  onChange={(e) => {
                    setSelectedUnits(e.target.value ? [e.target.value] : []);
                  }}
                  style={{ width: '140px', padding: '6px 32px 6px 12px', height: '36px' }}
                >
                  <option value="">All Units</option>
                  {availableUnits.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>

                {/* Resident Selector */}
                <select 
                  className={styles.selector}
                  value={selectedResidents.length > 0 ? selectedResidents[0] : ''}
                  onChange={(e) => {
                    setSelectedResidents(e.target.value ? [e.target.value] : []);
                  }}
                  style={{ width: '140px', padding: '6px 32px 6px 12px', height: '36px' }}
                >
                  <option value="">All Residents</option>
                  {availableResidents.map(resident => (
                    <option key={resident} value={resident}>{resident}</option>
                  ))}
                </select>

                {/* Divider Line */}
                <div style={{
                  width: '1px',
                  height: '24px',
                  backgroundColor: '#d1d5db',
                  margin: '0 10px'
                }} />

                {/* Export to PDF Button */}
                <button
                  className={styles['download-button']}
                  onClick={handleExportPDF}
                  disabled={Object.keys(allReportsData).length === 0 || loading}
                  style={{ 
                    marginBottom: '0',
                    padding: '10px 10px',
                    fontSize: '14px',
                    fontWeight: '500',
                    background: '#ffffff',
                    border: '2px solid #06b6d4',
                    color: '#06b6d4',
                    outline: 'none',
                    height: '36px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  Export to PDF
                </button>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div style={{ padding: '20px 30px', backgroundColor: '#f9fafb', width: '100%', boxSizing: 'border-box', flex: 1 }}>
            {loading && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p style={{ marginTop: '10px', color: '#6b7280' }}>Loading report data...</p>
              </div>
            )}
            {!loading && Object.keys(allReportsData).length > 0 && (
              <>
                {/* Statistics Section - Separate Island with matching width */}
                {allReportsData.timeOfDay && (
                  <div style={{ 
                    marginBottom: '30px',
                    width: '100%'
                  }}>
                    <div style={{ 
                      backgroundColor: '#fff',
                      padding: '24px 30px',
                      borderRadius: '12px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      width: '100%'
                    }}>
                      {/* Header with Title */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '16px'
                      }}>
                        <h2 style={{ 
                          fontSize: '20px', 
                          fontWeight: '700', 
                          color: '#111827',
                          margin: '0'
                        }}>
                          Statistics
                        </h2>
                      </div>
                      <p style={{ 
                        fontSize: '14px', 
                        color: '#6b7280',
                        marginTop: '0',
                        marginBottom: '24px'
                      }}>
                        Key metrics for {selectedHome} - {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(4, 1fr)', 
                        gap: '20px'
                      }}>
                        <div style={{
                          backgroundColor: '#f9fafb',
                          borderRadius: '8px',
                          padding: '20px',
                          border: '1px solid #e5e7eb',
                          minHeight: '100px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center'
                        }}>
                          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px', fontWeight: '500' }}>
                            Total Incidents
                          </div>
                          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827' }}>
                            {allReportsData.timeOfDay.summary.totalEvents}
                          </div>
                        </div>
                        <div style={{
                          backgroundColor: '#f9fafb',
                          borderRadius: '8px',
                          padding: '20px',
                          border: '1px solid #e5e7eb',
                          minHeight: '100px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center'
                        }}>
                          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px', fontWeight: '500' }}>
                            Residents Affected
                          </div>
                          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827' }}>
                            {allReportsData.timeOfDay.summary.residentsAffected}
                          </div>
                        </div>
                        <div style={{
                          backgroundColor: '#f9fafb',
                          borderRadius: '8px',
                          padding: '20px',
                          border: '1px solid #e5e7eb',
                          minHeight: '100px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center'
                        }}>
                          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px', fontWeight: '500' }}>
                            Locations Involved
                          </div>
                          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827' }}>
                            {allReportsData.timeOfDay.summary.unitsInvolved}
                          </div>
                        </div>
                        <div style={{
                          backgroundColor: '#f9fafb',
                          borderRadius: '8px',
                          padding: '20px',
                          border: '1px solid #e5e7eb',
                          minHeight: '100px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center'
                        }}>
                          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px', fontWeight: '500' }}>
                            Homes Affected
                          </div>
                          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827' }}>
                            1
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Render all reports */}
                {Object.entries(allReportsData).map(([reportType, reportData]) => {
                  const chartData = {
                    labels: reportData.chart.labels,
                    datasets: [{
                      label: 'Count',
                      data: reportData.chart.values,
                      backgroundColor: 'rgba(6, 182, 212, 0.6)',
                      borderColor: 'rgb(6, 182, 212)',
                      borderWidth: 1,
                    }],
                  };

                  const chartOptions = {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false,
                      },
                      tooltip: {
                        enabled: true,
                      },
                    },
                    scales: reportType === 'hour' ? {
                      x: {
                        ticks: {
                          maxRotation: 45,
                          minRotation: 45,
                        },
                        grid: {
                          display: false,
                        },
                      },
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 1,
                        },
                        grid: {
                          display: false,
                        },
                      },
                    } : {
                      x: {
                        grid: {
                          display: false,
                        },
                      },
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 1,
                        },
                        grid: {
                          display: false,
                        },
                      },
                    },
                  };

                  return (
                    <div key={reportType} style={{ 
                      marginBottom: '30px',
                      width: '100%'
                    }}>
                      {/* Main Island Card */}
                      <div style={{
                        backgroundColor: '#fff',
                        borderRadius: '12px',
                        padding: '24px 30px',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                        width: '100%'
                      }}>
                        {/* Report Title */}
                        <h2 style={{ 
                          fontSize: '20px', 
                          fontWeight: '700', 
                          color: '#111827',
                          marginBottom: '16px'
                        }}>
                          {getReportTypeLabel(reportType)}
                        </h2>
                        <p style={{ 
                          fontSize: '14px', 
                          color: '#6b7280',
                          marginBottom: '24px'
                        }}>
                          Behaviours by {getReportTypeLabel(reportType).toLowerCase()}
                        </p>

                        {/* Chart Sub-Island */}
                        <div style={{
                          backgroundColor: '#f9fafb',
                          borderRadius: '8px',
                          padding: '20px',
                          marginBottom: '30px',
                          border: '1px solid #e5e7eb'
                        }}>
                          <div 
                            ref={el => { if (el) chartRefs.current[reportType] = el; }} 
                            style={{ 
                              width: '100%', 
                              height: '400px',
                              position: 'relative'
                            }}
                          >
                            {chartData && <Bar data={chartData} options={chartOptions} />}
                          </div>
                        </div>

                        {/* Table Sub-Island */}
                        {reportData.table && reportData.table.length > 0 && (
                          <div style={{
                            backgroundColor: '#f9fafb',
                            borderRadius: '8px',
                            padding: '20px',
                            border: '1px solid #e5e7eb'
                          }}>
                            <h3 style={{ 
                              fontSize: '16px', 
                              fontWeight: '600', 
                              color: '#111827',
                              marginBottom: '16px'
                            }}>
                              Detailed {getReportTypeLabel(reportType)} Data
                            </h3>
                            <div style={{ overflowX: 'auto' }}>
                              <table className={styles.table} style={{ width: '100%' }}>
                                <thead>
                                  <tr>
                                    <th>Category</th>
                                    <th>Count</th>
                                    <th>Percentage</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {reportData.table.map((row, index) => (
                                    <tr key={`${reportType}-${row.label}-${index}`}>
                                      <td>{row.label}</td>
                                      <td>{row.count}</td>
                                      <td>{row.percentage}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </>
          )}

            {!loading && Object.keys(allReportsData).length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                <p>No data available for the selected filters.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }


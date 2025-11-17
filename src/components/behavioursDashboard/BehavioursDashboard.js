'use client';

import React, { useEffect, useState, useRef } from 'react';
import styles from '@/styles/Behaviours.module.css';
import * as Papa from 'papaparse';
import { saveAs } from 'file-saver';
import { Chart, ArcElement, PointElement, LineElement } from 'chart.js';
import { ref, onValue, off, get, update, child, set, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  markPostFallNotes,
  countFallsByExactInjury,
  countFallsByLocation,
  countFallsByHIR,
  getMonthFromTimeRange,
  countResidentsWithRecurringFalls,
  countFallsByTimeOfDay,
  countFallsByDayOfWeek,
  countFallsByHour,
} from '@/lib/DashboardUtils';
import Modal from '../Modal.js';
import AnalysisChart from './subcomponents/BeAnalysisChart.js';
import BeTrackingTable from './subcomponents/BeTrackingTable.js';
import FollowUpChart from './subcomponents/BeFollowUpChart.js';
import BeFollowUpTable from './subcomponents/BeFollowUpTable.js';

Chart.register(ArcElement, PointElement, LineElement);

export default function BehavioursDashboard({ name, title, goal} ) {
  const altName = name === 'ONCB'
    ? 'oneill'
    : name === 'MCB'
      ? 'millCreek'
      : name === 'berkshire'
        ? 'berkshire'
        : name === 'banwell'
          ? 'banwell'
      : name;
  const months_forward = {
    '01': 'January',
    '02': 'February',
    '03': 'March',
    '04': 'April',
    '05': 'May',
    '06': 'June',
    '07': 'July',
    '08': 'August',
    '09': 'September',
    '10': 'October',
    '11': 'November',
    '12': 'December',
  };

  const months_backword = {
    January: '01',
    February: '02',
    March: '03',
    April: '04',
    May: '05',
    June: '06',
    July: '07',
    August: '08',
    September: '09',
    October: '10',
    November: '11',
    December: '12',
  };

  // Dummy follow-up data when Firebase data unavailable
  const DUMMY_FOLLOW_UP_DATA = [
    {
      id: '1',
      resident_name: 'ANDERSON, GEORGE',
      date: '2025-01-15',
      summary_of_behaviour: 'Increased agitation during evening hours, refusing medication and care',
      other_notes: 'Physician Note'
    },
    {
      id: '2',
      resident_name: 'BRYMER, WENDY',
      date: '2025-01-14',
      summary_of_behaviour: 'Wandering behavior, attempting to leave facility and enter other residents\' rooms',
      other_notes: 'Progress Note'
    },
    {
      id: '3',
      resident_name: 'CLELAND, AILEEN',
      date: '2025-01-13',
      summary_of_behaviour: 'Verbal aggression towards staff and other residents, increased paranoia',
      other_notes: 'Resident/Family Follow Up'
    },
    {
      id: '4',
      resident_name: 'COX, CICELY (001106)',
      date: '2025-01-12',
      summary_of_behaviour: 'Depression symptoms, social withdrawal, refusing meals and activities',
      other_notes: ''
    },
    {
      id: '5',
      resident_name: 'ANDERSON, GEORGE',
      date: '2025-01-11',
      summary_of_behaviour: 'Sleep disturbances, nighttime confusion, calling out for assistance',
      other_notes: ''
    }
  ];

  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [threeMonthData, setThreeMonthData] = useState(new Map());
  const [followUpData, setFollowUpData] = useState([]);
  const [showFollowUpTable, setShowFollowUpTable] = useState(false);
  const [followUpLoading, setFollowUpLoading] = useState(true);
  const getCurrentMonth = () => {
    const today = new Date();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');  // Convert 1-12 to "01"-"12"
    return months_forward[month];  // Convert "01" to "January" etc.
  };
  const [desiredMonth, setDesiredMonth] = useState(getCurrentMonth());
  const [desiredYear, setDesiredYear] = useState(new Date().getFullYear());
  const [filterResident, setFilterResident] = useState("Any Resident");
const [filterBehaviorType, setFilterBehaviorType] = useState("All Types");
const [filterTimeOfDay, setFilterTimeOfDay] = useState("Anytime");
  
  // Follow-up specific filters
  const [filterFollowUpResident, setFilterFollowUpResident] = useState("Any Resident");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  // const [desiredMonth, setDesiredMonth] = useState('January');
  // const [desiredYear, setDesiredYear] = useState(2025);
  const [availableYearMonth, setAvailableYearMonth] = useState({});
  // console.log('year month');
  // console.log(desiredYear);
  // console.log(desiredMonth);
  // console.log('availableYearMonth');
  // console.log(availableYearMonth);

  // console.log('data');
  // console.log(data);
  // console.log(currentMonth);
  // console.log('threeMonthData');
  // console.log(threeMonthData);

  const [gaugeChart, setGaugeChart] = useState(true);
  const [fallsTimeRange, setFallsTimeRange] = useState('current');

  const [currentIntervention, setCurrentIntervention] = useState('');
  const [currentRowIndex, setCurrentRowIndex] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showResidentNames, setShowResidentNames] = useState(false);

  const [currentCauseOfFall, setCurrentCauseOfFall] = useState('');
  const [currentCauseRowIndex, setCurrentCauseRowIndex] = useState(null);
  const [isCauseModalOpen, setIsCauseModalOpen] = useState(false);

  const [currentPostFallNotes, setCurrentPostFallNotes] = useState('');
  const [currentPostFallNotesRowIndex, setCurrentPostFallNotesRowIndex] = useState(null);
  const [isPostFallNotesModalOpen, setIsPostFallNotesModalOpen] = useState(false);

  const [residentsNeedingReview, setResidentsNeedingReview] = useState([]);
  const [currentResidentIndex, setCurrentResidentIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const [incidentType, setIncidentType] = useState('Falls');
  const [insightOutcomes, setInsightOutcomes] = useState({});
  const [reviewedInsights, setReviewedInsights] = useState({});
  const [insights, setInsights] = useState([]);

  const MOCK_INCIDENT_DATA = {
    'Falls': {
      'home1': 12,
      'home2': 8,
      'home3': 15,
      'home4': 6,
      'vmltc': 10,
      'oneill': 9,
      'lancaster': 7,
      'goderich': 11
    },
    'Abuse/Neglect/Personal Expression of Needs': {
      'home1': 3,
      'home2': 2,
      'home3': 4,
      'home4': 1,
      'vmltc': 2,
      'oneill': 3,
      'lancaster': 1,
      'goderich': 2
    },
    'Death': {
      'home1': 1,
      'home2': 2,
      'home3': 1,
      'home4': 1,
      'vmltc': 2,
      'oneill': 1,
      'lancaster': 1,
      'goderich': 1
    },
    'Injury': {
      'home1': 7,
      'home2': 5,
      'home3': 8,
      'home4': 4,
      'vmltc': 6,
      'oneill': 5,
      'lancaster': 3,
      'goderich': 6
    },
    'Elopement': {
      'home1': 2,
      'home2': 1,
      'home3': 3,
      'home4': 1,
      'vmltc': 2,
      'oneill': 2,
      'lancaster': 1,
      'goderich': 2
    },
    'Fire': {
      'home1': 0,
      'home2': 1,
      'home3': 0,
      'home4': 0,
      'vmltc': 1,
      'oneill': 0,
      'lancaster': 0,
      'goderich': 0
    }
  };

  function expandedLog(item, maxDepth = 100, depth = 0) {
    if (depth > maxDepth) {
      console.log(item);
      return;
    }
    if (typeof item === 'object' && item !== null) {
      Object.entries(item).forEach(([key, value]) => {
        console.group(key + ' : ' + typeof value);
        expandedLog(value, maxDepth, depth + 1);
        console.groupEnd();
      });
    } else {
      console.log(item);
    }
  }

  const [gaugeChartData, setGaugeChartData] = useState({
    labels: [],
    datasets: [],
  });

  const gaugeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '80%',
    plugins: {
      tooltip: { enabled: false },
      legend: { display: false },
    },
  };

  const [lineChartData, setLineChartData] = useState({
    labels: [],
    datasets: [],
  });

  // console.log('lineChartData');
  // console.log(lineChartData);

  const lineChartOptions = {
    scales: {
      y: {
        beginAtZero: true,
        min: 0,
        max: 70,
        ticks: {
          stepSize: 10,
        },
      },
    },
    plugins: {
      legend: { display: false },
    },
  };

  const handleEditIntervention = (index) => {
    setCurrentIntervention(data[index].interventions);
    setCurrentRowIndex(index);
    setIsModalOpen(true);
  };


  const getTimeOfDay = (time) => {
    if (!time) return "Anytime";
    const hour = new Date("1970-01-01T" + time).getHours();
    if (hour >= 6 && hour < 12) return "Morning";
    if (hour >= 12 && hour < 20) return "Evening";
    return "Night";
  };
  const handleEditCauseOfFall = (index) => {
    setCurrentCauseOfFall(data[index].cause);
    setCurrentCauseRowIndex(index);
    setIsCauseModalOpen(true);
  };

  const handleSubmitCauseOfFall = () => {
    if (currentCauseOfFall === data[currentCauseRowIndex].cause) {
      setIsCauseModalOpen(false);
      return;
    }

    const updatedData = [...data];
    updatedData[currentCauseRowIndex].cause = currentCauseOfFall;
    updatedData[currentCauseRowIndex].isCauseUpdated = 'yes';

    const rowRef = ref(
      db,
      `/${altName}/${desiredYear}/${months_backword[desiredMonth]}/row-${data[currentCauseRowIndex].id}`
    );
    update(rowRef, { cause: currentCauseOfFall, isCauseUpdated: 'yes' })
      .then(() => {
        console.log('Cause of fall updated successfully');
        setData(updatedData);
        setIsCauseModalOpen(false);
      })
      .catch((error) => {
        console.error('Error updating cause of fall:', error);
      });
  };

  const handleEditPostFallNotes = (index) => {
    setCurrentPostFallNotes(data[index].postFallNotes);
    setCurrentPostFallNotesRowIndex(index);
    setIsPostFallNotesModalOpen(true);
  };

  const handleSubmitPostFallNotes = () => {
    if (currentPostFallNotes === data[currentPostFallNotesRowIndex].postFallNotes) {
      setIsPostFallNotesModalOpen(false);
      return;
    }

    let updatedData = [...data];
    updatedData[currentPostFallNotesRowIndex].postFallNotes = currentPostFallNotes;
    updatedData[currentPostFallNotesRowIndex].isPostFallNotesUpdated = 'yes';
    updatedData = markPostFallNotes(updatedData);

    const rowRef = ref(
      db,
      `/${altName}/${desiredYear}/${months_backword[desiredMonth]}/row-${data[currentPostFallNotesRowIndex].id}`
    );
    update(rowRef, { postFallNotes: currentPostFallNotes, isPostFallNotesUpdated: 'yes' })
      .then(() => {
        console.log('Post Fall Notes updated successfully');
        setData(updatedData);
        setIsPostFallNotesModalOpen(false);
      })
      .catch((error) => {
        console.error('Error updating post fall notes:', error);
      });
  };

  const handleSubmitIntervention = () => {
    if (currentIntervention === data[currentRowIndex].interventions) {
      setIsModalOpen(false);
      return;
    }

    const updatedData = [...data];
    updatedData[currentRowIndex].interventions = currentIntervention;
    updatedData[currentRowIndex].isInterventionsUpdated = 'yes';

    const rowRef = ref(db, `/${altName}/${desiredYear}/${months_backword[desiredMonth]}/row-${data[currentRowIndex].id}`);
    update(rowRef, {
      interventions: currentIntervention,
      isInterventionsUpdated: 'yes',
    })
      .then(() => {
        console.log('Intervention updated successfully');
        setData(updatedData);
        setIsModalOpen(false);
      })
      .catch((error) => {
        console.error('Error updating intervention:', error);
      });
  };

  const filteredData = data.filter((item) => {
  // Resident filter
  if (filterResident !== "Any Resident" && item.name !== filterResident) return false;

  // Behavior type filter
  if (filterBehaviorType !== "All Types" && item.incident_type !== filterBehaviorType)
    return false;

  // Time of day filter
  if (filterTimeOfDay !== "Anytime") {
    const tod = getTimeOfDay(item.time);
    if (tod !== filterTimeOfDay) return false;
  }

  return true;
});

  // Filter follow-up data
  const filteredFollowUpData = followUpData.filter((item) => {
    // Resident filter for follow-ups
    if (filterFollowUpResident !== "Any Resident" && item.resident_name !== filterFollowUpResident) return false;

    // Date range filter
    if (filterStartDate && item.date && new Date(item.date) < new Date(filterStartDate)) return false;
    if (filterEndDate && item.date && new Date(item.date) > new Date(filterEndDate)) return false;

    return true;
  });
  const updateFallsChart = () => {
    const timeRange = fallsTimeRange;
    const currentBehaviours = countTotalBehaviours();
    let newData;

    if (currentBehaviours >= goal) {
      newData = [goal, 0];
    } else {
      newData = [currentBehaviours, goal - currentBehaviours];
    }

    let threeMonthX = [];
    let threeMonthY = [];

    // Special handling for specific homes
    switch(name) {
      case 'vmltc':
        threeMonthX = ['October', 'November', 'December'];
        threeMonthY = [39, 27, 33];  // Replace with your desired values
        break;
      case 'bonairltc':
        threeMonthX = ['October', 'November', 'December'];
        threeMonthY = [8, 6, 7];
        break;
      case 'oneill':
        threeMonthX = ['October', 'November', 'December'];
        threeMonthY = [15, 12, 13];
        break;
      case 'lancaster':
        threeMonthX = ['October', 'November', 'December'];
        threeMonthY = [7, 11, 9];
        break;
      case 'champlain':
        threeMonthX = ['October', 'November', 'December'];
        threeMonthY = [19, 14, 11];
        break;
      default:
        // Original logic for other homes
        for (const [key, value] of threeMonthData) {
          threeMonthX.push(months_forward[key]);
          threeMonthY.push(value.length);
        }
    }

    switch (timeRange) {
      case 'current':
        setGaugeChart(true);
        setGaugeChartData({
          datasets: [
            {
              data: newData,
              backgroundColor: ['rgba(76, 175, 80, 0.8)', 'rgba(200, 200, 200, 0.2)'],
              circumference: 180,
              rotation: 270,
            },
          ],
        });
        break;
      case '3months':
        setGaugeChart(false);
        setLineChartData({
          labels: threeMonthX,
          datasets: [
            {
              label: 'Number of Behaviours',
              data: threeMonthY,
              borderColor: 'rgb(76, 175, 80)',
              tension: 0.1,
            },
          ],
        });
        break;
      default:
        break;
    }
  };

  function countTotalBehaviours() {
    return data.length;
  }

  const tableRef = useRef(null);

  const handleSavePDF = async () => {
    // work no blank but last pages lack

    if (tableRef.current) {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
      });
      tableRef.current.style.overflowX = 'visible';
      const pageHeight = pdf.internal.pageSize.height;
      const pageWidth = pdf.internal.pageSize.width;
      const totalHeight = tableRef.current.scrollHeight;
      tableRef.current.scrollTop = totalHeight - pageHeight;
      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        width: tableRef.current.scrollWidth,
        height: 1.25 * totalHeight,
      });
      // console.log('canvas width');
      // console.log('canvas width');
      // console.log('canvas height');
      // console.log('canvas height');
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth;
      // const newWindow = window.open();
      // newWindow.document.write(`<img src="${imgData}" alt="Captured Image"/>`);

      // canvas.height / canvas.width = imgheight / imgwidth
      // imgheight = canvas.height * imgwidth / canvas.width
      const imgHeight = (canvas.height * imgWidth) / canvas.width; // 按比例压缩高度
      let position = 0;

      // Loop to split the canvas and add to each page
      while (position < imgHeight) {
        pdf.addImage(imgData, 'PNG', 0, -position, imgWidth, imgHeight);

        position += pageHeight;

        // If the current height has not reached the total image height, add a new page
        if (position < imgHeight) {
          pdf.addPage();
        }
      }
      tableRef.current.style.overflowX = 'auto';
      
      // Set filename based on current table
      const monthNum = months_backword[desiredMonth];
      const filename = showFollowUpTable 
        ? `${name}_${desiredYear}_${monthNum}_follow_ups.pdf`
        : `${name}_${desiredYear}_${monthNum}_behaviours_data.pdf`;
      
      pdf.save(filename);
    }
  };

  const handleSaveCSV = () => {
    let modifiedData;
    let filename;
    
    if (showFollowUpTable) {
      // Export follow-up data
      const dataToExport = followUpData.length > 0 ? filteredFollowUpData : DUMMY_FOLLOW_UP_DATA;
      modifiedData = dataToExport.map((item, index) => ({
        'Follow-up Number': String(index + 1),
        'Resident Name': item.resident_name || 'Unknown Resident',
        'Date': item.date || 'Unknown Date',
        'Summary of Behaviour': item.summary_of_behaviour || 'No summary available',
        'Other Notes Included': item.other_notes || 'No notes available'
      }));
      
      const monthNum = months_backword[desiredMonth];
      filename = `${name}_${desiredYear}_${monthNum}_follow_ups.csv`;
    } else {
      // Export behaviors data
      modifiedData = data.map(item => ({
        ...item,
        'Significant Injury Flag': 
          item.injuries?.toLowerCase().includes('head injury') || 
          item.injuries?.toLowerCase().includes('fracture') || 
          item.injuries?.toLowerCase().includes('skin tear') 
            ? 'Yes' 
            : 'No',
        'Non Compliance Flag':
          item.poaContacted?.toLowerCase() === 'no' ||
          item.cause === 'No Fall Note' ||
          (item.postFallNotes < 3)
            ? 'Yes'
            : 'No'
      }));
      
      const monthNum = months_backword[desiredMonth];
      filename = `${name}_${desiredYear}_${monthNum}_behaviours_data.csv`;
    }
    
    const csv = Papa.unparse(modifiedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    
    saveAs(blob, filename);
  };

  const handleUpdateCSV = async (index, newValue, name, changeType) => {
    const collectionRef = ref(db, `/${altName}/${desiredYear}/${months_backword[desiredMonth]}`);

    try {
      const snapshot = await get(collectionRef);

      if (snapshot.exists()) {
        const rows = snapshot.val();
        let targetRowKey = null;

        for (const [key, row] of Object.entries(rows)) {
          if (row.id === String(index)) {  
            targetRowKey = key;
            break;
          }
        }

        if (targetRowKey) {
          const rowRef = child(collectionRef, targetRowKey);
          const currentRowData = rows[targetRowKey];

          let updates = {};

          switch (changeType) {
            case 'hir':
              updates = { hir: newValue, isHirUpdated: 'yes' };
              break;
            case 'transfer_to_hospital':
              updates = { transfer_to_hospital: newValue, isHospitalUpdated: 'yes' };
              break;
            case 'ptRef':
              updates = { ptRef: newValue, isPtRefUpdated: 'yes' };
              break;
            case 'poaContacted':
              updates = { poaContacted: newValue, isPoaContactedUpdated: 'yes' };
              break;
            case 'physicianRef':
              updates = { physicianRef: newValue, isPhysicianRefUpdated: 'yes' };
              break;
            case 'incidentReport':
              updates = { incidentReport: newValue, isIncidentReportUpdated: 'yes' };
              break;
            default:
              console.error('Invalid changeType');
              return;
          }

          const updateKey = Object.keys(updates)[1];
          const hasBeenUpdated = currentRowData[updateKey] === 'yes';

          if (hasBeenUpdated && currentRowData[changeType] === newValue) {
            return;
          }

          await update(rowRef, updates);
          console.log(`Row with id ${index} updated successfully.`);

          const updatedData = data.map(item => 
            item.id === String(index) 
              ? { ...item, [changeType]: newValue, [updateKey]: 'yes' } 
              : item
          );
          setData(updatedData);
        } else {
          console.error(`Row with id ${index} not found.`);
        }
      } else {
        console.error('No data found in the specified path.');
      }
    } catch (error) {
      console.error('Error updating row:', error);
    }
  };

  const getDataLengths = async () => {
    setIsLoading(true);
    
    if (incidentType !== 'Falls') {
      // Use mock data for other incident types
      const mockData = MOCK_INCIDENT_DATA[incidentType];
      setIsLoading(false);
      return mockData;
    }

    // Original falls data fetching logic
    const homes = ['home1', 'home2', 'home3', 'home4', 'vmltc', 'oneill', 'lancaster', 'goderich'];
    const dataLengths = {};
    
    try {
      // ... rest of the original function ...
    } catch (error) {
      console.error('Error fetching data:', error);
      return {};
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let dataRef = ref(db, `/${altName}/behaviours/${desiredYear}/${months_backword[desiredMonth]}`);
    if (altName === 'berkshire' || altName === 'banwell') {
      dataRef = ref(db, `/${altName}/${desiredYear}/${months_backword[desiredMonth]}`);
    } 

    const currentYear = desiredYear;
    const currentMonth = parseInt(months_backword[desiredMonth]);
    const pastThreeMonths = [];

    for (let i = 3; i >= 1; i--) {
      const month = currentMonth - i;
      if (month > 0) {
        pastThreeMonths.push({ year: currentYear, month: String(month).padStart(2, '0') });
      } else {
        pastThreeMonths.push({ year: currentYear - 1, month: String(12 + month).padStart(2, '0') });
      }
    }

    const allBehavioursData = new Map();
    for (let i = 0; i < pastThreeMonths.length; i++) {
      allBehavioursData.set(pastThreeMonths[i].month, []);
    }

    pastThreeMonths.forEach(({ year, month }) => {
      let monthRef = ref(db, `/${altName}/behaviours/${year}/${month}`);

      if (altName === 'berkshire' || altName === 'banwell') {
        monthRef = ref(db, `/${altName}/${year}/${month}`);
      } 

      const listener = onValue(monthRef, (snapshot) => {
        if (snapshot.exists()) {
          const behavioursData = snapshot.val();
          const monthData = Object.keys(behavioursData).map((key) => behavioursData[key]);
          allBehavioursData.set(month, monthData);
        }
      });
      return () => off(monthRef, listener);
    });
    setThreeMonthData(allBehavioursData);

    const listener = onValue(dataRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetchedData = snapshot.val();
        
        if (!fetchedData) {
          setData([]);
          setIsLoading(false);
          return;
        }

        let withIdData = Object.values(fetchedData).map(item => ({
          ...item,
          id: item.id || ''
        }));

        const sortedData = withIdData.sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );
        setData(sortedData);
        setIsLoading(false);
      } else {
        setData([]);
        setIsLoading(false);
      }
    });

    const followUpRef = ref(db, `/${altName}/follow/${currentYear}/${months_backword[desiredMonth]}`);
    const followUpListener = onValue(followUpRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetchedFollowUpData = snapshot.val();
        
        if (!fetchedFollowUpData) {
          setFollowUpData([]);
          setFollowUpLoading(false);
          return;
        }

        let withIdFollowUpData = Object.values(fetchedFollowUpData).map((item, index) => ({
          ...item,
          id: item.id || String(index + 1),
          resident_name: item.resident_name || item.Name || 'Unknown Resident',
          date: item.date || 'Unknown Date',
          summary_of_behaviour: item.summary_of_behaviour || 'No summary available',
          other_notes: item.other_notes || 'No notes available'
        }));

        const sortedFollowUpData = withIdFollowUpData.sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );
        setFollowUpData(sortedFollowUpData);
        setFollowUpLoading(false);
      } else {
        setFollowUpData([]);
        setFollowUpLoading(false);
      }
    });

    return () => {
      off(dataRef, listener);
      off(followUpRef, followUpListener);
    };
  }, [desiredMonth, desiredYear]);

  useEffect(() => {
    updateFallsChart();
    // console.log('Falls Chart');
  }, [fallsTimeRange, data, desiredMonth]);

  useEffect(() => {
    if (data.length > 0) {
      const processedData = data.map((item, index) => {
        
        // Determine color based on post-fall notes count and existing update status
        const postFallNotesColor = 
          item.isPostFallNotesUpdated !== 'yes' && item.postFallNotes < 3 ? 'red' : 'inherit';
        
        return {
          ...item,
          postFallNotesColor,
        };
      });
  
      // Only update if there's a change to prevent unnecessary re-renders
      const dataChanged = JSON.stringify(processedData) !== JSON.stringify(data);
      if (dataChanged) {
        setData(processedData);
      }
    }
  }, [data]);

  const handleYearChange = (e) => {
    const selectedYear = e.target.value;
    setDesiredYear(selectedYear);

    // When year changes, set month to the first available month for that year
    const availableMonths = availableYearMonth[selectedYear] || [];
    if (availableMonths.length > 0) {
      setDesiredMonth(availableMonths[0]);
    }
  };

  const handleMonthChange = (event) => {
    const selectedMonth = event.target.value;
    setDesiredMonth(selectedMonth);
  };


  const handleUnitChange = (event) => {
    // setDesiredUnit(event.target.value);
  };

  // Calculate behavior metrics for overview
  const calculateBehaviorMetrics = () => {
    if (!data || data.length === 0) return { antipsychotics: 0, worsened: 0, improved: 0 };
    
    let antipsychoticsCount = 0;
    let worsenedCount = 0;
    let improvedCount = 0;
    let totalCount = data.length;
    
    data.forEach(item => {
      // Check for antipsychotics without prescription
      if (item.antipsychotic === 'yes' && (!item.prescription || item.prescription === 'no')) {
        antipsychoticsCount++;
      }
      
      // Check for behaviors worsened
      if (item.behavior_change === 'worsened' || item.behavior_change === 'worse') {
        worsenedCount++;
      }
      
      // Check for behaviors improved
      if (item.behavior_change === 'improved' || item.behavior_change === 'better') {
        improvedCount++;
      }
    });
    
    return {
      antipsychotics: totalCount > 0 ? Math.round((antipsychoticsCount / totalCount) * 100) : 0,
      worsened: totalCount > 0 ? Math.round((worsenedCount / totalCount) * 100) : 0,
      improved: totalCount > 0 ? Math.round((improvedCount / totalCount) * 100) : 0
    };
  };

  useEffect(() => {
    let yearsRef;
    if (altName === 'berkshire' || altName === 'banwell') {
      yearsRef = ref(db, `/${altName}`);
    } else {
      yearsRef = ref(db, `/${altName}/behaviours`);
    }
    
    onValue(yearsRef, (snapshot) => {
      const yearMonthMapping = {};
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        Object.keys(data).forEach(year => {
          if (!yearMonthMapping[year]) {
            yearMonthMapping[year] = [];
          }
          
          Object.keys(data[year] || {}).forEach(month => {
            if (data[year][month]) {
              yearMonthMapping[year].push(months_forward[month]);
            }
          });
          
          yearMonthMapping[year].sort((a, b) => {
            return months_backword[a] - months_backword[b];
          });
        });

        const sortedYears = Object.keys(yearMonthMapping).sort((a, b) => b - a);
        const sortedMapping = {};
        sortedYears.forEach(year => {
          sortedMapping[year] = yearMonthMapping[year];
        });

        setAvailableYearMonth(sortedMapping);

        const today = new Date();
        const currentYear = today.getFullYear().toString();
        const currentMonth = getCurrentMonth();
        
        let yearToUse = currentYear;
        let monthToUse = currentMonth;
        
        if (!sortedMapping[yearToUse]?.includes(monthToUse)) {
          if (sortedMapping[yearToUse]?.length > 0) {
            const currentMonthNum = months_backword[currentMonth];
            const availableMonths = sortedMapping[yearToUse].map(m => months_backword[m]);
            const closestMonth = availableMonths.reduce((prev, curr) => {
              return Math.abs(curr - currentMonthNum) < Math.abs(prev - currentMonthNum) ? curr : prev;
            });
            monthToUse = months_forward[closestMonth];
          } else {
            yearToUse = sortedYears[0];
            monthToUse = sortedMapping[yearToUse][sortedMapping[yearToUse].length - 1];
          }
        }
        
        setDesiredYear(parseInt(yearToUse));
        setDesiredMonth(monthToUse);
      }
    });
  }, []);

  const checkForUnreviewedResidents = async () => {
    const fallsRef = ref(db, `/${altName}/${desiredYear}/${months_backword[desiredMonth]}`);
    const reviewsRef = ref(db, `/reviews/${altName}/${desiredYear}/${months_backword[desiredMonth]}`);
    
    const [fallsSnapshot, reviewsSnapshot] = await Promise.all([
      get(fallsRef),
      get(reviewsRef)
    ]);

    const fallsData = fallsSnapshot.val();
    const reviewsData = reviewsSnapshot.val() || {};

    if (fallsData) {
      const fallCounts = {};
      Object.values(fallsData).forEach(fall => {
        if (fall.name) {
          fallCounts[fall.name] = (fallCounts[fall.name] || 0) + 1;
        }
      });

      const needReview = Object.entries(fallCounts)
        .filter(([residentName, count]) => {
          const review = reviewsData[residentName];
          if (!review) return count >= 3;
          
          if (review.needsReminder && review.lastReminderTime) {
            const reminderTime = new Date(review.lastReminderTime);
            const now = new Date();
            return count >= 3 && (now - reminderTime) >= 86400000;
          }
          
          return false;
        })
        .map(([residentName]) => ({
          name: residentName
        }));

      setResidentsNeedingReview(needReview);
      if (needReview.length > 0) {
        setCurrentResidentIndex(0);
        setShowModal(true);
      }
    }
  };

  useEffect(() => {
    checkForUnreviewedResidents();
    const interval = setInterval(checkForUnreviewedResidents, 10000);
    
    return () => clearInterval(interval);
  }, [altName, desiredMonth]);

  const markReviewDone = async (resident) => {
    const reviewRef = ref(db, `/reviews/${altName}/${desiredYear}/${months_backword[desiredMonth]}/${resident.name}`);
    await set(reviewRef, {
      reviewed: true,
      reviewedAt: serverTimestamp(),
      needsReminder: false,
      lastReminderTime: null
    });
    
    await checkForUnreviewedResidents();
  };

  const handleRemindLater = async () => {
    const currentResident = residentsNeedingReview[currentResidentIndex];
    const reviewRef = ref(db, `/reviews/${altName}/${desiredYear}/${months_backword[desiredMonth]}/${currentResident.name}`);
    
    await set(reviewRef, {
      reviewed: false,
      needsReminder: true,
      lastReminderTime: serverTimestamp()
    });

    if (currentResidentIndex < residentsNeedingReview.length - 1) {
      setCurrentResidentIndex(prev => prev + 1);
    } else {
      setShowModal(false);
      setCurrentResidentIndex(0);
    }
  };

  const getAllInsights = () => {
    // Map insights from Firebase
    const allInsights = insights.map(insight => {
      // Check if this insight exists in Firebase (has outcome or reviewed status)
      const firebaseData = insightOutcomes[insight.id] || {};
      const isReviewed = reviewedInsights[insight.id] || false;
      
      return {
        ...insight,
        outcome: firebaseData.outcome || null,
        reviewed: isReviewed
      };
    });

    // Filter out reviewed insights
    return allInsights.filter(insight => !insight.reviewed);
  };

  const handleOutcomeChange = async (insightId, newOutcome) => {
    try {
      const insightRef = ref(db, `/${altName}/insights/${desiredYear}/${months_backword[desiredMonth]}/${insightId}`);
      await update(insightRef, {
        outcome: newOutcome,
        timestamp: serverTimestamp()
      });
      
      setInsightOutcomes(prev => ({
        ...prev,
        [insightId]: { outcome: newOutcome }
      }));
    } catch (error) {
      console.error('Error updating insight outcome:', error);
    }
  };

  const handleReviewInsight = async (insightId) => {
    try {
      const insightRef = ref(db, `/${altName}/insights/${desiredYear}/${months_backword[desiredMonth]}/${insightId}`);
      await update(insightRef, {
        reviewed: true,
        reviewedAt: serverTimestamp()
      });
      
      setReviewedInsights(prev => ({
        ...prev,
        [insightId]: true
      }));
    } catch (error) {
      console.error('Error marking insight as reviewed:', error);
    }
  };

  useEffect(() => {
    const loadInsightData = async () => {
      const insightsRef = ref(db, `/${altName}/insights/${desiredYear}/${months_backword[desiredMonth]}`);
      const snapshot = await get(insightsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const outcomes = {};
        const reviewed = {};
        const insightsList = [];
        
        Object.entries(data).forEach(([id, insight]) => {
          if (typeof insight === 'string') {
            insightsList.push({
              id,
              emoji: '📊',
              content: insight
            });
          } else if (insight.content) {
            insightsList.push({
              id,
              emoji: insight.emoji || '📊',
              content: insight.content
            });
          }
          
          if (insight.outcome) outcomes[id] = insight;
          if (insight.reviewed) reviewed[id] = true;
        });
        
        setInsights(insightsList);
        setInsightOutcomes(outcomes);
        setReviewedInsights(reviewed);
      } else {
        setInsights([]);
        setInsightOutcomes({});
        setReviewedInsights({});
      }
    };
    loadInsightData();
  }, [altName, desiredYear, desiredMonth]);


  const cleanDuplicateText = (text, field) => {
    if (!text) return text;
    
    if (field === 'interventions') {
      // Clean up the specific pattern in interventions
      return text.replace(/No Progress Note Found Within 24hrs of RIM\s*Within 24hrs of RIM/g, 'No Progress Note Found Within 24hrs of RIM');
    } else if (field === 'triggers') {
      // Clean up the specific pattern in triggers
      return text.replace(/Within 24hrs of RIM\s*Within 24hrs of RIM\s*Within 24hrs of RIM/g, 'Within 24hrs of RIM');
    }
    return text;
  };

  return (
    <div className={styles.dashboard} ref={tableRef}>
      <div className={styles.topHeader}
        style={
          {marginLeft: '10px'}
        }>
        <h1>{title}</h1>
        <div className={styles.dateSelector} >
          <button
            onClick={() => setShowFollowUpTable(!showFollowUpTable)}
            className={`${styles.toggleButton} ${showFollowUpTable ? styles.active : styles.inactive}`}
            style={{height: '50px'}}
          >
            {showFollowUpTable ? 'Show Behaviours' : 'Show Follow-ups'}
          </button>

          <select className={styles.selector} style={{height: '50px'}}onChange={handleYearChange} value={desiredYear}>
            {Object.keys(availableYearMonth).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <select className={styles.selector}  style={{height: '50px'}} onChange={handleMonthChange} value={desiredMonth}>
            {(availableYearMonth[desiredYear] || []).map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* <button className="logout-button" onClick={logout}>
        Log Out
      </button> */}

      <div className={styles['chart-container']}>
          {/* {analysisChartData.datasets.length > 0 && <Bar data={analysisChartData} options={analysisChartOptions} />} */}
        {showFollowUpTable &&
          <FollowUpChart
            data={(followUpData.length > 0 ? filteredFollowUpData : DUMMY_FOLLOW_UP_DATA)}
            desiredYear={desiredYear}
            desiredMonth={desiredMonth}
          />
        }
        
        { !showFollowUpTable &&
          <AnalysisChart 
            data={data} 
            desiredYear={desiredYear} 
            desiredMonth={desiredMonth} 
            threeMonthData={threeMonthData}
            getTimeOfDay={getTimeOfDay}
            />
        }

        <div className={styles.chart}>
          <div className={styles['gauge-container']}>
            <div className={styles.topHeader}>
              
              <h3>Behaviours Overview</h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom:'2px'}}>
                <label style={{ fontSize: '14px'}}>
                  Show Resident Names:
                </label>
                <input
                  type="checkbox"
                  checked={showResidentNames}
                  onChange={(e) => setShowResidentNames(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
      
              <div style={{ 
                backgroundColor: '#F8F9FA', 
                border: '2px solid #28a745', 
                borderRadius: '12px', 
                padding: '20px',
                boxShadow: '0 4px 8px rgba(40, 167, 69, 0.15)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ 
                    backgroundColor: '#28a745', 
                    borderRadius: '20%', 
                    padding: '10px',
                    width: '60px', 
                    height: '60px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: 'bold'
                  }}>
                    15%
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0D0E10', marginBottom: '5px' }}>
                      % of Residents with Potentially Inappropriate Use of Antipsychotics
                    </h3>
                    <p style={{ fontSize: '14px', color: '#676879', margin: 0 }}>
                      Residents receiving antipsychotics without proper documentation
                    </p>
                    {showResidentNames && (
                      <div style={{ marginTop: '10px', fontSize: '18px', color: '#676879' }}>
                        <strong>Residents:</strong> John Smith, Mary Johnson, Robert Davis
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>-3%</div>
                  <div style={{ fontSize: '12px', color: '#676879' }}>vs last month</div>
                </div>
              </div>

              {/* Behaviours Worsened Card */}
              <div style={{ 
                backgroundColor: '#F8F9FA', 
                border: '2px solid #28a745', 
                borderRadius: '12px', 
                padding: '20px',
                boxShadow: '0 4px 8px rgba(40, 167, 69, 0.15)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ 
                    backgroundColor: '#28a745', 
                    borderRadius: '20%', 
                    padding: '10px',
                    width: '60px', 
                    height: '60px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: 'bold'
                  }}>
                    28%
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0D0E10', marginBottom: '5px' }}>
                      % of Behaviours Worsened
                    </h3>
                    <p style={{ fontSize: '14px', color: '#676879', margin: 0 }}>
                      Residents showing increased behavioral challenges
                    </p>
                    {showResidentNames && (
                      <div style={{ marginTop: '10px', fontSize: '18px', color: '#676879' }}>
                        <strong>Residents:</strong> Sarah Wilson, Michael Brown, Lisa Anderson
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>+5%</div>
                  <div style={{ fontSize: '12px', color: '#676879' }}>vs last month</div>
                </div>
              </div>

              {/* Behaviours Improved Card */}
              <div style={{ 
                backgroundColor: '#F8F9FA', 
                border: '2px solid #28a745', 
                borderRadius: '12px', 
                padding: '20px',
                boxShadow: '0 4px 8px rgba(40, 167, 69, 0.15)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ 
                    backgroundColor: '#28a745', 
                    borderRadius: '20%', 
                    padding: '10px',
                    width: '60px', 
                    height: '60px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: 'bold'
                  }}>
                    57%
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0D0E10', marginBottom: '5px' }}>
                      % of Behaviours Improved
                    </h3>
                    <p style={{ fontSize: '14px', color: '#676879', margin: 0 }}>
                      Residents showing positive behavioral changes
                    </p>
                    {showResidentNames && (
                      <div style={{ marginTop: '10px', fontSize: '18px', color: '#676879' }}>
                        <strong>Residents:</strong> David Miller, Jennifer Taylor, Thomas White
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>+8%</div>
                  <div style={{ fontSize: '12px', color: '#676879' }}>vs last month</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={styles['table-header']}>
        <div className={styles['header']} style={{marginBottom: '10px', marginLeft: '10px'}}>
          <h2>
            {showFollowUpTable ? 'Behaviour Follow-ups' : 'Behaviours Tracking Table'}
          </h2>
        </div>
      </div>
      
      <div className={styles['table-header']}>
        <div className={styles['header']}>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        {!showFollowUpTable ? (
          <>
            {/* Behavior Tracking Filters */}
            <select className={styles.selector}value={filterResident} onChange={(e) => setFilterResident(e.target.value)}>
                <option>Any Resident</option>
                {[...new Set(data.map((d) => d.name))].map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>

              {/* Behavior Type Filter */}
              <select className={styles.selector} value={filterBehaviorType} onChange={(e) => setFilterBehaviorType(e.target.value)}>
                <option>All Types</option>
                {[...new Set(data.map((d) => d.incident_type))].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>

              {/* Time of Day Filter */}
              <select className={styles.selector} value={filterTimeOfDay} onChange={(e) => setFilterTimeOfDay(e.target.value)}>
                <option>Anytime</option>
                <option>Morning</option>
                <option>Evening</option>
                <option>Night</option>
              </select>
          </>
        ) : (
          <>
            {/* Follow-up Filters */}
            <select className={styles.selector} value={filterFollowUpResident} onChange={(e) => setFilterFollowUpResident(e.target.value)}>
              <option>Any Resident</option>
              {[...new Set(followUpData.map((d) => d.resident_name))].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>

            {/* Start Date Filter */}
            <input
              type="date"
              className={styles.selector}
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              placeholder="Start Date"
              style={{ padding: '8px' }}
            />

            {/* End Date Filter */}
            <input
              type="date"
              className={styles.selector}
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              placeholder="End Date"
              style={{ padding: '8px' }}
            />

            {/* Clear Date Filters Button */}
            <button
              onClick={() => {
                setFilterStartDate("");
                setFilterEndDate("");
              }}
              style={{
                padding: '8px 12px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Clear Dates
            </button>
          </>
        )}
      </div>
        </div>
        <div>
          <button className={styles['download-button']} onClick={handleSaveCSV}>
            Download as CSV
          </button>
          <button className={styles['download-button']} onClick={handleSavePDF}>
            Download as PDF
          </button>
        </div>
      </div>

      {!showFollowUpTable ? (
        <BeTrackingTable 
          filteredData={filteredData} 
          cleanDuplicateText={cleanDuplicateText} 
          storageKey={`${name}_${desiredYear}_${desiredMonth}_behaviours_checked`}
        />
      ) : (
        <BeFollowUpTable 
          filteredData={filteredFollowUpData}
          DUMMY_FOLLOW_UP_DATA={DUMMY_FOLLOW_UP_DATA}
          followUpLoading={followUpLoading}
        />
      )}
      {isModalOpen && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div>
              <h2>Edit Interventions</h2>
              <textarea value={currentIntervention} onChange={(e) => setCurrentIntervention(e.target.value)} />
              <br />
              <button onClick={handleSubmitIntervention}>Submit</button>
              <button onClick={() => setIsModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {isCauseModalOpen && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div>
              <h2>Edit Cause of Falls</h2>
              <textarea value={currentCauseOfFall} onChange={(e) => setCurrentCauseOfFall(e.target.value)} />
              <br />
              <button onClick={handleSubmitCauseOfFall}>Submit</button>
              <button onClick={() => setIsCauseModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {isPostFallNotesModalOpen && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div>
              <h2>Edit Post Fall Notes</h2>
              <textarea value={currentPostFallNotes} onChange={(e) => setCurrentPostFallNotes(e.target.value)} />
              <br />
              <button onClick={handleSubmitPostFallNotes}>Submit</button>
              <button onClick={() => setIsPostFallNotesModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showModal && residentsNeedingReview.length > 0 && residentsNeedingReview[currentResidentIndex] && (
        <Modal 
          showModal={true}
          handleClose={() => setShowModal(false)}
          showCloseButton={false}
          modalContent={
            <div>
              <h3 style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '15px' }}>Special Care Review Needed:</h3>
              <p style={{ fontSize: '18px', marginBottom: '25px', }}>
                <b style={{ fontSize: '18px', fontWeight: 'bold' }}> 
                  {residentsNeedingReview[currentResidentIndex]?.name} 
                </b> has had 3 or more falls 
                in the past month. Have you completed a special care review?
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'left', marginBottom: '25px' }}>
                <button 
                  onClick={() => residentsNeedingReview[currentResidentIndex] && 
                    markReviewDone(residentsNeedingReview[currentResidentIndex])}
                  style={{ padding: '10px', backgroundColor: 'green', color: 'white', fontFamily: 'inherit', fontSize: '16px', borderRadius: '12px', border: 'transparent', cursor: 'pointer'}}
                >
                  Yes, Review Complete
                </button>
                <button 
                  onClick={handleRemindLater}
                  style={{ backgroundColor: '#D3D3D3', padding: '10px', fontFamily: 'inherit', fontSize: '16px', fontFamily: 'inherit', borderRadius: '12px', border: 'transparent', cursor: 'pointer'}}
                >
                  Remind me in 24 hours
                </button>
              </div>
            </div>
          }
        />
      )}
    </div>
  );
}
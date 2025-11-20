import React, { useEffect, useState } from 'react';
import styles from '../../../styles/Behaviours.module.css';
import { Bar } from 'react-chartjs-2';

const FollowUpChart = ({data, desiredYear, desiredMonth}) => {
    
    const [analysisChartData, setAnalysisChartData] = useState({
        labels: [],
        datasets: [],
    });
    const [analysisType, setAnalysisType] = useState('residents');
    const [analysisHeaderText, setAnalysisHeaderText] = useState('Follow-ups by Resident');

    useEffect(() => {
        updateAnalysisChart();
    }, [analysisType, data, desiredYear]);

    function countTotalFollowUps() {
        return data.length;
    }

    const countFollowUpsByResident = (data) => {
        const counts = {};
        data.forEach(item => {
            const resident = item.resident_name;
            if (resident) {
                counts[resident] = (counts[resident] || 0) + 1;
            }
        });
        return counts;
    };

    const countFollowUpsByNoteType = (data) => {
        const counts = {};
        data.forEach(item => {
            const noteType = item.other_notes || 'No Category';
            if (noteType.trim()) {
                counts[noteType] = (counts[noteType] || 0) + 1;
            } else {
                counts['No Category'] = (counts['No Category'] || 0) + 1;
            }
        });
        return counts;
    };


    const countFollowUpsByMonth = (data) => {
        const counts = {};
        data.forEach(item => {
            const date = new Date(item.date);
            const month = date.toLocaleDateString('en-US', { month: 'long' });
            if (month && month !== 'Invalid Date') {
                counts[month] = (counts[month] || 0) + 1;
            }
        });
        return counts;
    };

    const countFollowUpsByWeek = (data) => {
        const counts = {};
        data.forEach(item => {
            const date = new Date(item.date);
            const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
            const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (weekLabel && weekLabel !== 'Invalid Date') {
                counts[`Week of ${weekLabel}`] = (counts[`Week of ${weekLabel}`] || 0) + 1;
            }
        });
        return counts;
    };

    const updateAnalysisChart = () => {
        let newLabels = [];
        let newData = [];

        switch (analysisType) {
            case 'residents':
                setAnalysisHeaderText('Follow-ups by Resident');
                var residentCounts = countFollowUpsByResident(data);
                // Sort by count in descending order
                const sortedResidents = Object.entries(residentCounts)
                    .sort(([,a], [,b]) => b - a);
                newLabels = sortedResidents.map(([label]) => label);
                newData = sortedResidents.map(([,count]) => count);
                break;

            case 'monthly':
                setAnalysisHeaderText('Follow-ups by Month');
                var monthlyCounts = countFollowUpsByMonth(data);
                // Sort chronologically
                const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June',
                                  'July', 'August', 'September', 'October', 'November', 'December'];
                const sortedMonths = Object.entries(monthlyCounts)
                    .sort(([a], [b]) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
                newLabels = sortedMonths.map(([label]) => label);
                newData = sortedMonths.map(([,count]) => count);
                break;

            case 'weekly':
                setAnalysisHeaderText('Follow-ups by Week');
                var weeklyCounts = countFollowUpsByWeek(data);
                // Sort by date
                const sortedWeeks = Object.entries(weeklyCounts)
                    .sort(([a], [b]) => new Date(a.replace('Week of ', '')) - new Date(b.replace('Week of ', '')));
                newLabels = sortedWeeks.map(([label]) => label);
                newData = sortedWeeks.map(([,count]) => count);
                break;
        }

        setAnalysisChartData({
            labels: newLabels,
            datasets: [
                {
            data: newData,
            backgroundColor: 'rgba(6, 182, 212, 0.6)',
            borderColor: 'rgb(6, 182, 212)',
            borderWidth: 1,
                },
            ],
        });
    };

    const analysisChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                grid: {
                    display: false,
                },
                barPercentage: 1,
                categoryPercentage: 1,
                ticks: {
                    color: '#495057',
                }
            },
            y: {
                beginAtZero: true,
                ticks: {
                    stepSize: 1,
                    color: '#495057',
                },
                grid: {
                    display: false,
                }
            },
        },
        plugins: {
            tooltip: { 
                enabled: true,
            },
            legend: { display: false },
        },
    };
    
    return (
        <div className={styles.chart} style={{
            display: 'flex', 
            justifyContent: 'space-between', 
            flexDirection: 'column', 
            flex: '1'
        }}>
          <div className={styles.topHeader} style={{ marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>{analysisHeaderText}</h3>
            <select
                className={styles.selector}
                id="followUpAnalysisType"
                value={analysisType}
                onChange={(e) => {
                    setAnalysisType(e.target.value);
                }}
            >
                <option value="residents">By Resident</option>
                <option value="monthly">By Month</option>
                <option value="weekly">By Week</option>
            </select>
          </div>
          <div style={{ flex: '1', height: '100%', minHeight: '200px' }}> 
            {analysisChartData.datasets.length > 0 && <Bar data={analysisChartData} options={analysisChartOptions} />}
          </div>
        </div>
    );
};

export default FollowUpChart;
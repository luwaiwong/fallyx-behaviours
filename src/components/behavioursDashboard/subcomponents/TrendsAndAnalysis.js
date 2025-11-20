'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import styles from '@/styles/Behaviours.module.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function TrendsAndAnalysis({ name, altName, data, getTimeOfDay, startDate, endDate }) {
  const [viewMode, setViewMode] = useState('holistic'); // 'holistic' or 'personalized'
  const [selectedResident, setSelectedResident] = useState('');
  const [availableResidents, setAvailableResidents] = useState([]);
  const [analysisData, setAnalysisData] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // Extract available residents from data
  useEffect(() => {
    if (data && data.length > 0) {
      const residents = [...new Set(data.map(item => item.name).filter(Boolean))];
      setAvailableResidents(residents.sort());
      if (residents.length > 0 && !selectedResident) {
        setSelectedResident(residents[0]);
      }
    }
  }, [data]);

  // Filter data by date range
  const filteredData = useMemo(() => {
    if (!data || !startDate || !endDate) return [];
    
    return data.filter(item => {
      if (!item.date) return false;
      const itemDate = new Date(item.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      return itemDate >= start && itemDate <= end;
    });
  }, [data, startDate, endDate]);

  // Calculate analysis data
  useEffect(() => {
    if (filteredData.length === 0) {
      setAnalysisData(null);
      setAiInsights(null);
      return;
    }

    const dataToAnalyze = viewMode === 'personalized' && selectedResident
      ? filteredData.filter(item => item.name === selectedResident)
      : filteredData;

    if (dataToAnalyze.length === 0) {
      setAnalysisData(null);
      setAiInsights(null);
      return;
    }

    const analysis = calculateAnalysis(dataToAnalyze, getTimeOfDay);
    setAnalysisData(analysis);
  }, [filteredData, viewMode, selectedResident, getTimeOfDay]);

  // Fetch AI insights when analysis data changes
  useEffect(() => {
    if (!analysisData || filteredData.length === 0) {
      setAiInsights(null);
      return;
    }

    const fetchAIInsights = async () => {
      setLoadingAI(true);
      try {
        const dataToAnalyze = viewMode === 'personalized' && selectedResident
          ? filteredData.filter(item => item.name === selectedResident)
          : filteredData;

        const response = await fetch('/api/trends/ai-insights', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: dataToAnalyze,
            analysisSummary: {
              totalIncidents: analysisData.summary.totalIncidents,
              residentsAffected: analysisData.summary.residentsAffected,
              mostCommonType: analysisData.summary.mostCommonType,
              peakTime: analysisData.summary.peakTime,
              overallTrend: analysisData.trends.overallTrend,
              topTriggers: analysisData.topTriggers,
              topInterventions: analysisData.topInterventions,
              timeOfDayCounts: {},
              dayOfWeekCounts: {}
            },
            viewMode,
            residentName: viewMode === 'personalized' ? selectedResident : undefined
          }),
        });

        if (response.ok) {
          const result = await response.json();
          setAiInsights(result.insights);
        } else {
          console.error('Failed to fetch AI insights');
          setAiInsights(null);
        }
      } catch (error) {
        console.error('Error fetching AI insights:', error);
        setAiInsights(null);
      } finally {
        setLoadingAI(false);
      }
    };

    fetchAIInsights();
  }, [analysisData, filteredData, viewMode, selectedResident]);

  if (!analysisData) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
        <h2 style={{ marginBottom: '16px' }}>Trends and Analysis</h2>
        <p>No data available for the selected date range.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <h1 style={{
          fontSize: '22px',
          fontWeight: '700',
          color: '#111827',
          margin: '0'
        }}>
          Trends and Analysis
        </h1>

        {/* View Mode Toggle */}
        <div style={{
          display: 'flex',
          gap: '8px',
          backgroundColor: '#f3f4f6',
          padding: '4px',
          borderRadius: '8px'
        }}>
          <button
            onClick={() => setViewMode('holistic')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: viewMode === 'holistic' ? '#3b82f6' : 'transparent',
              color: viewMode === 'holistic' ? 'white' : '#6b7280',
              fontWeight: viewMode === 'holistic' ? '600' : '400',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Holistic
          </button>
          <button
            onClick={() => setViewMode('personalized')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: viewMode === 'personalized' ? '#3b82f6' : 'transparent',
              color: viewMode === 'personalized' ? 'white' : '#6b7280',
              fontWeight: viewMode === 'personalized' ? '600' : '400',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Personalized
          </button>
        </div>

        {/* Resident Selector (only for personalized view) */}
        {viewMode === 'personalized' && (
          <select
            value={selectedResident}
            onChange={(e) => setSelectedResident(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              minWidth: '200px'
            }}
          >
            {availableResidents.map(resident => (
              <option key={resident} value={resident}>{resident}</option>
            ))}
          </select>
        )}
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        <SummaryCard
          title="Total Incidents"
          value={analysisData.summary.totalIncidents}
          subtitle={`${analysisData.summary.residentsAffected} resident${analysisData.summary.residentsAffected !== 1 ? 's' : ''} affected`}
          trend={analysisData.trends.overallTrend}
        />
        <SummaryCard
          title="Avg per Day"
          value={analysisData.summary.avgPerDay.toFixed(1)}
          subtitle={`${analysisData.summary.daysWithData} days with data`}
        />
        <SummaryCard
          title="Most Common Type"
          value={analysisData.summary.mostCommonType}
          subtitle={`${analysisData.summary.mostCommonTypeCount} occurrences`}
        />
        <SummaryCard
          title="Peak Time"
          value={analysisData.summary.peakTime}
          subtitle={`${analysisData.summary.peakTimeCount} incidents`}
        />
      </div>

      {/* Charts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Trend Over Time */}
        <ChartCard title="Trend Over Time">
          <Line
            data={analysisData.charts.trendOverTime}
            options={{
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                legend: { 
                  display: true, 
                  position: 'top',
                  labels: {
                    font: {
                      size: 12
                    },
                    padding: 15,
                    boxWidth: 20
                  }
                },
                tooltip: { mode: 'index', intersect: false }
              },
              scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Number of Incidents' } },
                x: { title: { display: true, text: 'Date' } }
              }
            }}
          />
        </ChartCard>

        {/* Behaviour Types Distribution */}
        <ChartCard title="Behaviour Types Distribution">
          <Doughnut
            data={analysisData.charts.behaviourTypes}
            options={{
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                legend: { 
                  display: true, 
                  position: 'right',
                  labels: {
                    boxWidth: 20,
                    padding: 15,
                    font: {
                      size: 12
                    },
                    maxWidth: 200, // Allow wider labels
                    generateLabels: function(chart) {
                      const data = chart.data;
                      if (data.labels.length && data.datasets.length) {
                        return data.labels.map((label, i) => {
                          const dataset = data.datasets[0];
                          return {
                            text: label, // Use full label without truncation
                            fillStyle: dataset.backgroundColor[i],
                            hidden: false,
                            index: i
                          };
                        });
                      }
                      return [];
                    }
                  }
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return context.label + ': ' + context.parsed;
                    }
                  }
                }
              }
            }}
          />
        </ChartCard>

        {/* Time of Day Pattern */}
        <ChartCard title="Time of Day Pattern">
          <Bar
            data={analysisData.charts.timeOfDay}
            options={{
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                legend: { display: false }
              },
              scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Number of Incidents' } },
                x: { 
                  title: { display: true, text: 'Time of Day' },
                  ticks: {
                    maxRotation: 0,
                    minRotation: 0,
                    font: {
                      size: 11
                    }
                  }
                }
              }
            }}
          />
        </ChartCard>

        {/* Day of Week Pattern */}
        <ChartCard title="Day of Week Pattern">
          <Bar
            data={analysisData.charts.dayOfWeek}
            options={{
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                legend: { display: false }
              },
              scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Number of Incidents' } },
                x: { 
                  title: { display: true, text: 'Day of Week' },
                  ticks: {
                    maxRotation: 0,
                    minRotation: 0,
                    font: {
                      size: 11
                    }
                  }
                }
              }
            }}
          />
        </ChartCard>
      </div>

      {/* Insights Section */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '32px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#111827',
          marginBottom: '16px'
        }}>
          Key Insights
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {analysisData.insights.map((insight, idx) => (
            <div
              key={idx}
              style={{
                padding: '12px 16px',
                backgroundColor: insight.severity === 'high' ? '#fef2f2' : insight.severity === 'medium' ? '#fffbeb' : '#f0fdf4',
                borderLeft: `4px solid ${insight.severity === 'high' ? '#ef4444' : insight.severity === 'medium' ? '#f59e0b' : '#10b981'}`,
                borderRadius: '4px'
              }}
            >
              <div style={{
                fontWeight: '600',
                color: '#111827',
                marginBottom: '4px'
              }}>
                {insight.title}
              </div>
              <div style={{ color: '#6b7280', fontSize: '14px' }}>
                {insight.description}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI-Powered Clinical Insights */}
      {loadingAI ? (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '32px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ color: '#6b7280' }}>🤖 Generating AI-powered clinical insights...</div>
        </div>
      ) : aiInsights && isValidAIInsights(aiInsights) ? (
        <>
          {/* Clinical Assessment */}
          {aiInsights.clinicalAssessment && 
           !aiInsights.clinicalAssessment.toLowerCase().includes('unable to generate') &&
           !aiInsights.clinicalAssessment.toLowerCase().includes('unable to assess') && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <span style={{ fontSize: '20px' }}>👩‍⚕️</span>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#111827',
                  margin: '0'
                }}>
                  Clinical Assessment
                </h2>
              </div>
              <div style={{
                color: '#374151',
                lineHeight: '1.6',
                whiteSpace: 'pre-line'
              }}>
                {aiInsights.clinicalAssessment}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {aiInsights.recommendations && aiInsights.recommendations.length > 0 && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <span style={{ fontSize: '20px' }}>💡</span>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#111827',
                  margin: '0'
                }}>
                  Evidence-Based Recommendations
                </h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {aiInsights.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '16px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '6px',
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px'
                    }}>
                      <div style={{
                        fontWeight: '600',
                        color: '#111827',
                        fontSize: '16px'
                      }}>
                        {rec.title}
                      </div>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: rec.priority === 'High' ? '#fef2f2' : rec.priority === 'Medium' ? '#fffbeb' : '#f0fdf4',
                        color: rec.priority === 'High' ? '#dc2626' : rec.priority === 'Medium' ? '#d97706' : '#059669'
                      }}>
                        {rec.priority} Priority
                      </span>
                    </div>
                    <div style={{
                      color: '#374151',
                      marginBottom: '8px',
                      lineHeight: '1.6'
                    }}>
                      {rec.description}
                    </div>
                    <div style={{
                      color: '#6b7280',
                      fontSize: '14px',
                      fontStyle: 'italic'
                    }}>
                      <strong>Rationale:</strong> {rec.rationale}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Care Plan Suggestions */}
          {aiInsights.carePlanSuggestions && aiInsights.carePlanSuggestions.length > 0 && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <span style={{ fontSize: '20px' }}>📋</span>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#111827',
                  margin: '0'
                }}>
                  Care Plan Suggestions
                </h2>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '16px'
              }}>
                {aiInsights.carePlanSuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '16px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '6px',
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    <div style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#3b82f6',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '8px'
                    }}>
                      {suggestion.category}
                    </div>
                    <div style={{
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: '8px'
                    }}>
                      {suggestion.suggestion}
                    </div>
                    <div style={{
                      color: '#6b7280',
                      fontSize: '14px',
                      lineHeight: '1.5'
                    }}>
                      {suggestion.rationale}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Factors */}
          {aiInsights.riskFactors && aiInsights.riskFactors.length > 0 && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <span style={{ fontSize: '20px' }}>⚠️</span>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#111827',
                  margin: '0'
                }}>
                  Risk Factors & Mitigation
                </h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {aiInsights.riskFactors.map((risk, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '16px',
                      backgroundColor: risk.severity === 'High' ? '#fef2f2' : risk.severity === 'Medium' ? '#fffbeb' : '#f0fdf4',
                      borderRadius: '6px',
                      borderLeft: `4px solid ${risk.severity === 'High' ? '#ef4444' : risk.severity === 'Medium' ? '#f59e0b' : '#10b981'}`
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px'
                    }}>
                      <div style={{
                        fontWeight: '600',
                        color: '#111827'
                      }}>
                        {risk.factor}
                      </div>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: risk.severity === 'High' ? '#fee2e2' : risk.severity === 'Medium' ? '#fef3c7' : '#d1fae5',
                        color: risk.severity === 'High' ? '#991b1b' : risk.severity === 'Medium' ? '#92400e' : '#065f46'
                      }}>
                        {risk.severity} Risk
                      </span>
                    </div>
                    <div style={{
                      color: '#374151',
                      fontSize: '14px',
                      lineHeight: '1.6'
                    }}>
                      <strong>Recommendation:</strong> {risk.recommendation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Intervention Effectiveness */}
          {aiInsights.interventionEffectiveness && 
           !aiInsights.interventionEffectiveness.toLowerCase().includes('unable to generate') &&
           !aiInsights.interventionEffectiveness.toLowerCase().includes('unable to assess') && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              marginBottom: '32px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <span style={{ fontSize: '20px' }}>📊</span>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#111827',
                  margin: '0'
                }}>
                  Intervention Effectiveness Analysis
                </h2>
              </div>
              <div style={{
                color: '#374151',
                lineHeight: '1.6',
                whiteSpace: 'pre-line'
              }}>
                {aiInsights.interventionEffectiveness}
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* Top Triggers */}
      {analysisData.topTriggers.length > 0 && (
        <div style={{
          marginBottom: '32px'
        }}>
          <TableCard title="Top Triggers" data={analysisData.topTriggers} />
        </div>
      )}

      {/* Pattern Analysis */}
      {viewMode === 'personalized' && analysisData.personalizedPatterns && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
            marginBottom: '16px'
          }}>
            Personalized Patterns for {selectedResident}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {analysisData.personalizedPatterns.map((pattern, idx) => (
              <div
                key={idx}
                style={{
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb'
                }}
              >
                <div style={{
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '8px'
                }}>
                  {pattern.title}
                </div>
                <div style={{ color: '#6b7280', fontSize: '14px' }}>
                  {pattern.description}
                </div>
                {pattern.details && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: '#374151'
                  }}>
                    {pattern.details}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components
function SummaryCard({ title, value, subtitle, trend }) {
  const trendColor = trend === 'increasing' ? '#ef4444' : trend === 'decreasing' ? '#10b981' : '#6b7280';
  const trendIcon = trend === 'increasing' ? '↑' : trend === 'decreasing' ? '↓' : '→';

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        fontSize: '14px',
        color: '#6b7280',
        marginBottom: '8px'
      }}>
        {title}
      </div>
      <div style={{
        fontSize: '28px',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '4px'
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '12px',
        color: '#9ca3af'
      }}>
        {subtitle}
      </div>
      {trend && (
        <div style={{
          marginTop: '8px',
          fontSize: '12px',
          color: trendColor,
          fontWeight: '600'
        }}>
          {trendIcon} {trend === 'increasing' ? 'Increasing' : trend === 'decreasing' ? 'Decreasing' : 'Stable'}
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      width: '100%'
    }}>
      <h3 style={{
        fontSize: '16px',
        fontWeight: '600',
        color: '#111827',
        marginBottom: '16px',
        textAlign: 'center'
      }}>
        {title}
      </h3>
      <div style={{ 
        height: '300px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        {children}
      </div>
    </div>
  );
}

function TableCard({ title, data }) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <h3 style={{
        fontSize: '16px',
        fontWeight: '600',
        color: '#111827',
        marginBottom: '16px'
      }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {data.length > 0 ? (
          data.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                backgroundColor: idx % 2 === 0 ? '#f9fafb' : 'white',
                borderRadius: '4px'
              }}
            >
              <div style={{ flex: 1, color: '#111827' }}>
                {item.label || 'N/A'}
              </div>
              <div style={{
                fontWeight: '600',
                color: '#3b82f6',
                marginLeft: '16px'
              }}>
                {item.count}
              </div>
            </div>
          ))
        ) : (
          <div style={{ color: '#9ca3af', padding: '12px' }}>
            No data available
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to check if AI insights are valid (not error messages)
function isValidAIInsights(insights) {
  if (!insights) return false;
  
  const hasValidAssessment = insights.clinicalAssessment && 
    !insights.clinicalAssessment.toLowerCase().includes('unable to generate') &&
    !insights.clinicalAssessment.toLowerCase().includes('unable to assess') &&
    !insights.clinicalAssessment.toLowerCase().includes('please review the data manually');
  
  const hasValidRecommendations = insights.recommendations && 
    insights.recommendations.length > 0;
  
  const hasValidCarePlan = insights.carePlanSuggestions && 
    insights.carePlanSuggestions.length > 0;
  
  const hasValidRiskFactors = insights.riskFactors && 
    insights.riskFactors.length > 0;
  
  const hasValidEffectiveness = insights.interventionEffectiveness && 
    !insights.interventionEffectiveness.toLowerCase().includes('unable to generate') &&
    !insights.interventionEffectiveness.toLowerCase().includes('unable to assess');
  
  return hasValidAssessment || hasValidRecommendations || hasValidCarePlan || hasValidRiskFactors || hasValidEffectiveness;
}

// Analysis Calculation Functions
function calculateAnalysis(data, getTimeOfDay) {
  const totalIncidents = data.length;
  const residents = [...new Set(data.map(item => item.name).filter(Boolean))];
  const residentsAffected = residents.length;

  // Date range
  const dates = data.map(item => new Date(item.date)).filter(d => !isNaN(d.getTime()));
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  const daysDiff = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
  const daysWithData = new Set(data.map(item => item.date)).size;
  const avgPerDay = totalIncidents / daysDiff;

  // Behaviour types
  const typeCounts = {};
  data.forEach(item => {
    const type = item.incident_type || item.behaviour_type || 'Unknown';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });
  const sortedTypes = Object.entries(typeCounts).sort(([,a], [,b]) => b - a);
  const mostCommonType = sortedTypes[0]?.[0] || 'N/A';
  const mostCommonTypeCount = sortedTypes[0]?.[1] || 0;

  // Time of day
  const timeOfDayCounts = { Morning: 0, Evening: 0, Night: 0 };
  data.forEach(item => {
    if (item.time) {
      const timeOfDay = getTimeOfDay(item.time);
      if (timeOfDayCounts.hasOwnProperty(timeOfDay)) {
        timeOfDayCounts[timeOfDay]++;
      }
    }
  });
  const sortedTimeOfDay = Object.entries(timeOfDayCounts).sort(([,a], [,b]) => b - a);
  const peakTime = sortedTimeOfDay[0]?.[0] || 'N/A';
  const peakTimeCount = sortedTimeOfDay[0]?.[1] || 0;

  // Trend over time (daily)
  const dailyCounts = {};
  data.forEach(item => {
    if (item.date) {
      dailyCounts[item.date] = (dailyCounts[item.date] || 0) + 1;
    }
  });
  const sortedDates = Object.keys(dailyCounts).sort();
  const trendData = sortedDates.map(date => ({
    date,
    count: dailyCounts[date]
  }));

  // Calculate trend direction
  const firstHalf = trendData.slice(0, Math.floor(trendData.length / 2));
  const secondHalf = trendData.slice(Math.floor(trendData.length / 2));
  const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d.count, 0) / firstHalf.length || 0;
  const secondHalfAvg = secondHalf.reduce((sum, d) => sum + d.count, 0) / secondHalf.length || 0;
  const overallTrend = secondHalfAvg > firstHalfAvg * 1.1 ? 'increasing' : 
                       secondHalfAvg < firstHalfAvg * 0.9 ? 'decreasing' : 'stable';

  // Day of week
  const dayOfWeekCounts = {
    'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0,
    'Thursday': 0, 'Friday': 0, 'Saturday': 0
  };
  data.forEach(item => {
    if (item.date) {
      const date = new Date(item.date);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      if (dayOfWeekCounts.hasOwnProperty(dayName)) {
        dayOfWeekCounts[dayName]++;
      }
    }
  });

  // Helper function to filter out noise/placeholder text
  const isNoise = (text) => {
    if (!text) return true;
    const lowerText = text.toLowerCase().trim();
    const noisePatterns = [
      'no progress note found within 24hrs of rim',
      'not specified in this format',
      'n/a',
      'none',
      'unknown',
      'no data',
      'no information',
      'within 24hrs of rim',
      'within 24hrs of rim within 24hrs of rim'
    ];
    return noisePatterns.some(pattern => lowerText.includes(pattern)) || lowerText.length < 5;
  };

  // Triggers analysis
  const triggerCounts = {};
  data.forEach(item => {
    if (item.triggers) {
      const triggers = item.triggers.split(/[,\n;]/).map(t => t.trim()).filter(Boolean);
      triggers.forEach(trigger => {
        if (!isNoise(trigger)) {
          triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;
        }
      });
    }
  });
  const topTriggers = Object.entries(triggerCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([label, count]) => ({ label, count }))
    .filter(item => !isNoise(item.label));

  // Interventions analysis
  const interventionCounts = {};
  data.forEach(item => {
    if (item.interventions) {
      const interventions = item.interventions.split(/[,\n;]/).map(i => i.trim()).filter(Boolean);
      interventions.forEach(intervention => {
        if (!isNoise(intervention)) {
          interventionCounts[intervention] = (interventionCounts[intervention] || 0) + 1;
        }
      });
    }
  });
  const topInterventions = Object.entries(interventionCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([label, count]) => ({ label, count }))
    .filter(item => !isNoise(item.label));

  // Generate insights
  const insights = generateInsights({
    totalIncidents,
    residentsAffected,
    overallTrend,
    mostCommonType,
    peakTime,
    topTriggers,
    topInterventions,
    timeOfDayCounts,
    dayOfWeekCounts,
    data
  });

  // Personalized patterns (only for personalized view)
  const personalizedPatterns = residents.length === 1 ? generatePersonalizedPatterns(data, getTimeOfDay) : null;

  return {
    summary: {
      totalIncidents,
      residentsAffected,
      avgPerDay,
      daysWithData,
      mostCommonType,
      mostCommonTypeCount,
      peakTime,
      peakTimeCount
    },
    trends: {
      overallTrend,
      dailyTrend: trendData
    },
    charts: {
      trendOverTime: {
        labels: trendData.map(d => {
          const date = new Date(d.date);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }),
        datasets: [{
          label: 'Incidents per Day',
          data: trendData.map(d => d.count),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4
        }]
      },
      behaviourTypes: {
        labels: sortedTypes.slice(0, 8).map(([label]) => label),
        datasets: [{
          data: sortedTypes.slice(0, 8).map(([,count]) => count),
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(236, 72, 153, 0.8)',
            'rgba(14, 165, 233, 0.8)',
            'rgba(34, 197, 94, 0.8)'
          ]
        }]
      },
      timeOfDay: {
        labels: ['Morning', 'Evening', 'Night'],
        datasets: [{
          label: 'Incidents',
          data: [
            timeOfDayCounts.Morning,
            timeOfDayCounts.Evening,
            timeOfDayCounts.Night
          ],
          backgroundColor: 'rgba(59, 130, 246, 0.8)'
        }]
      },
      dayOfWeek: {
        labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        datasets: [{
          label: 'Incidents',
          data: [
            dayOfWeekCounts.Sunday,
            dayOfWeekCounts.Monday,
            dayOfWeekCounts.Tuesday,
            dayOfWeekCounts.Wednesday,
            dayOfWeekCounts.Thursday,
            dayOfWeekCounts.Friday,
            dayOfWeekCounts.Saturday
          ],
          backgroundColor: 'rgba(16, 185, 129, 0.8)'
        }]
      }
    },
    topTriggers,
    topInterventions,
    insights,
    personalizedPatterns
  };
}

function generateInsights({ totalIncidents, residentsAffected, overallTrend, mostCommonType, peakTime, topTriggers, topInterventions, timeOfDayCounts, dayOfWeekCounts, data }) {
  const insights = [];

  // Trend insight
  if (overallTrend === 'increasing') {
    insights.push({
      title: '⚠️ Increasing Trend Detected',
      description: `Behaviour incidents are showing an increasing trend. Consider reviewing recent interventions and triggers.`,
      severity: 'high'
    });
  } else if (overallTrend === 'decreasing') {
    insights.push({
      title: '✅ Improving Trend',
      description: `Behaviour incidents are decreasing, indicating positive outcomes from current interventions.`,
      severity: 'low'
    });
  }

  // Peak time insight
  if (peakTime && timeOfDayCounts[peakTime] > totalIncidents * 0.3) {
    insights.push({
      title: `📅 Peak Activity: ${peakTime}`,
      description: `Most incidents occur during ${peakTime.toLowerCase()} hours (${((timeOfDayCounts[peakTime] / totalIncidents) * 100).toFixed(1)}% of all incidents). Consider increasing staff presence or adjusting interventions during this time.`,
      severity: 'medium'
    });
  }

  // Most common type insight
  if (mostCommonType && mostCommonType !== 'Unknown') {
    insights.push({
      title: `🎯 Focus Area: ${mostCommonType}`,
      description: `${mostCommonType} is the most common behaviour type. Review interventions specific to this behaviour type.`,
      severity: 'medium'
    });
  }

  // High frequency residents
  const residentCounts = {};
  data.forEach(item => {
    if (item.name) {
      residentCounts[item.name] = (residentCounts[item.name] || 0) + 1;
    }
  });
  const highFrequencyResidents = Object.entries(residentCounts)
    .filter(([,count]) => count >= totalIncidents / residentsAffected * 2)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3);

  if (highFrequencyResidents.length > 0 && residentsAffected > 1) {
    insights.push({
      title: '👤 High-Frequency Residents',
      description: `The following residents have significantly more incidents than average: ${highFrequencyResidents.map(([name]) => name).join(', ')}. Consider personalized care plans.`,
      severity: 'high'
    });
  }

  // Top trigger insight
  if (topTriggers.length > 0 && topTriggers[0].count > 2) {
    insights.push({
      title: `🔍 Common Trigger: ${topTriggers[0].label}`,
      description: `"${topTriggers[0].label}" appears ${topTriggers[0].count} times as a trigger. Consider proactive interventions for this trigger.`,
      severity: 'medium'
    });
  }

  // Intervention effectiveness (if outcomes are available)
  const outcomesWithInterventions = data.filter(item => item.interventions && item.outcome);
  if (outcomesWithInterventions.length > 0) {
    const positiveOutcomes = outcomesWithInterventions.filter(item => {
      const outcome = (item.outcome || '').toLowerCase();
      return outcome.includes('resolved') || outcome.includes('improved') || outcome.includes('success');
    }).length;
    const effectivenessRate = (positiveOutcomes / outcomesWithInterventions.length) * 100;
    
    if (effectivenessRate < 50) {
      insights.push({
        title: '⚠️ Intervention Effectiveness',
        description: `Only ${effectivenessRate.toFixed(0)}% of interventions show positive outcomes. Review and adjust intervention strategies.`,
        severity: 'high'
      });
    }
  }

  return insights.length > 0 ? insights : [{
    title: '📊 Analysis Complete',
    description: 'Review the charts and patterns above for detailed insights into behaviour trends.',
    severity: 'low'
  }];
}

function generatePersonalizedPatterns(data, getTimeOfDay) {
  const patterns = [];

  // Time pattern
  const timeCounts = {};
  data.forEach(item => {
    if (item.time) {
      const timeOfDay = getTimeOfDay(item.time);
      timeCounts[timeOfDay] = (timeCounts[timeOfDay] || 0) + 1;
    }
  });
  const dominantTime = Object.entries(timeCounts).sort(([,a], [,b]) => b - a)[0];
  if (dominantTime && dominantTime[1] > data.length * 0.4) {
    patterns.push({
      title: `⏰ Time Pattern: ${dominantTime[0]}`,
      description: `Most incidents occur during ${dominantTime[0].toLowerCase()} hours.`,
      details: `Consider scheduling proactive interventions or increased monitoring during this time period.`
    });
  }

  // Behaviour type pattern
  const typeCounts = {};
  data.forEach(item => {
    const type = item.incident_type || item.behaviour_type || 'Unknown';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });
  const dominantType = Object.entries(typeCounts).sort(([,a], [,b]) => b - a)[0];
  if (dominantType && dominantType[1] > 1) {
    patterns.push({
      title: `🎯 Primary Behaviour: ${dominantType[0]}`,
      description: `The most frequent behaviour type is "${dominantType[0]}" (${dominantType[1]} occurrences).`,
      details: `Focus interventions on managing this specific behaviour type.`
    });
  }

  // Trigger pattern
  const triggerCounts = {};
  data.forEach(item => {
    if (item.triggers) {
      const triggers = item.triggers.split(/[,\n;]/).map(t => t.trim()).filter(Boolean);
      triggers.forEach(trigger => {
        if (trigger.length > 3) {
          triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;
        }
      });
    }
  });
  const topTrigger = Object.entries(triggerCounts).sort(([,a], [,b]) => b - a)[0];
  if (topTrigger && topTrigger[1] > 1) {
    patterns.push({
      title: `🔍 Common Trigger: ${topTrigger[0]}`,
      description: `"${topTrigger[0]}" appears ${topTrigger[1]} times as a trigger.`,
      details: `Develop proactive strategies to address this trigger before incidents occur.`
    });
  }

  // Frequency pattern
  const dates = data.map(item => new Date(item.date)).filter(d => !isNaN(d.getTime()));
  if (dates.length > 1) {
    const sortedDates = dates.sort((a, b) => a - b);
    const daysBetween = (sortedDates[sortedDates.length - 1] - sortedDates[0]) / (1000 * 60 * 60 * 24);
    const frequency = data.length / (daysBetween + 1);
    
    if (frequency > 0.5) {
      patterns.push({
        title: '📈 High Frequency Pattern',
        description: `Incidents occur approximately every ${(1 / frequency).toFixed(1)} days on average.`,
        details: `This resident requires close monitoring and proactive intervention strategies.`
      });
    }
  }

  return patterns;
}


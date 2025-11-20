import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface BehaviourData {
  name?: string;
  date?: string;
  time?: string;
  behaviour_type?: string;
  incident_type?: string;
  triggers?: string;
  interventions?: string;
  outcome?: string;
  medication_changes?: string;
  risks?: string;
  injuries?: string;
  description?: string;
  consequences?: string;
}

interface AnalysisSummary {
  totalIncidents: number;
  residentsAffected: number;
  mostCommonType: string;
  peakTime: string;
  overallTrend: string;
  topTriggers: Array<{ label: string; count: number }>;
  topInterventions: Array<{ label: string; count: number }>;
  timeOfDayCounts: Record<string, number>;
  dayOfWeekCounts: Record<string, number>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, analysisSummary, viewMode, residentName } = body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: 'No data provided' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Prepare data summary for AI
    const dataSummary = prepareDataSummary(data, analysisSummary, viewMode, residentName);

    // Generate AI insights
    const aiInsights = await generateAIInsights(dataSummary, viewMode, residentName);

    return NextResponse.json({
      success: true,
      insights: aiInsights
    });

  } catch (error) {
    console.error('Error generating AI insights:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI insights', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function prepareDataSummary(
  data: BehaviourData[],
  analysisSummary: AnalysisSummary,
  viewMode: string,
  residentName?: string
): string {
  const totalIncidents = data.length;
  const dateRange = getDateRange(data);
  const residents = [...new Set(data.map(item => item.name).filter(Boolean))];
  
  // Extract key patterns
  const behaviourTypes = extractFieldCounts(data, 'behaviour_type', 'incident_type');
  const triggers = extractFieldCounts(data, 'triggers');
  const interventions = extractFieldCounts(data, 'interventions');
  const outcomes = extractFieldCounts(data, 'outcome');
  const medicationChanges = data.filter(item => item.medication_changes && item.medication_changes.toLowerCase() !== 'no' && item.medication_changes.toLowerCase() !== 'none').length;
  const injuries = data.filter(item => item.injuries && item.injuries.toLowerCase() !== 'no injury').length;

  // Time patterns
  const timePatterns = extractTimePatterns(data);
  
  // Recent trends (last 30% vs first 30%)
  const recentTrend = calculateRecentTrend(data);

  let summary = `BEHAVIOUR ANALYSIS SUMMARY\n`;
  summary += `========================\n\n`;
  
  if (viewMode === 'personalized' && residentName) {
    summary += `RESIDENT: ${residentName}\n`;
  } else {
    summary += `HOME-WIDE ANALYSIS (${residents.length} residents)\n`;
  }
  
  summary += `Date Range: ${dateRange.start} to ${dateRange.end}\n`;
  summary += `Total Incidents: ${totalIncidents}\n`;
  summary += `Residents Affected: ${residents.length}\n\n`;

  summary += `BEHAVIOUR TYPES:\n`;
  Object.entries(behaviourTypes).slice(0, 5).forEach(([type, count]) => {
    summary += `- ${type}: ${count} occurrences (${((count/totalIncidents)*100).toFixed(1)}%)\n`;
  });
  summary += `\n`;

  summary += `TOP TRIGGERS:\n`;
  Object.entries(triggers).slice(0, 5).forEach(([trigger, count]) => {
    summary += `- "${trigger}": ${count} times\n`;
  });
  summary += `\n`;

  summary += `TOP INTERVENTIONS:\n`;
  Object.entries(interventions).slice(0, 5).forEach(([intervention, count]) => {
    summary += `- "${intervention}": ${count} times\n`;
  });
  summary += `\n`;

  summary += `OUTCOMES:\n`;
  Object.entries(outcomes).slice(0, 5).forEach(([outcome, count]) => {
    summary += `- "${outcome}": ${count} times\n`;
  });
  summary += `\n`;

  summary += `TIME PATTERNS:\n`;
  summary += `- Peak Time: ${timePatterns.peakTime} (${timePatterns.peakTimeCount} incidents)\n`;
  summary += `- Peak Day: ${timePatterns.peakDay} (${timePatterns.peakDayCount} incidents)\n`;
  summary += `\n`;

  summary += `TRENDS:\n`;
  summary += `- Overall Trend: ${recentTrend.direction} (${recentTrend.percentageChange > 0 ? '+' : ''}${recentTrend.percentageChange.toFixed(1)}%)\n`;
  summary += `\n`;

  summary += `ADDITIONAL CONTEXT:\n`;
  summary += `- Medication Changes: ${medicationChanges} incidents involved medication changes\n`;
  summary += `- Injuries: ${injuries} incidents resulted in injuries\n`;
  summary += `\n`;

  // Add sample incidents for context
  summary += `SAMPLE INCIDENTS (for context):\n`;
  data.slice(0, 5).forEach((item, idx) => {
    summary += `${idx + 1}. ${item.date || 'Unknown date'} - ${item.behaviour_type || item.incident_type || 'Unknown type'}\n`;
    if (item.triggers) summary += `   Trigger: ${item.triggers.substring(0, 100)}\n`;
    if (item.interventions) summary += `   Intervention: ${item.interventions.substring(0, 100)}\n`;
    if (item.outcome) summary += `   Outcome: ${item.outcome.substring(0, 100)}\n`;
    summary += `\n`;
  });

  return summary;
}

function extractFieldCounts(data: BehaviourData[], ...fields: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  
  data.forEach(item => {
    for (const field of fields) {
      const value = item[field as keyof BehaviourData] as string;
      if (value && typeof value === 'string') {
        // Split by common delimiters
        const parts = value.split(/[,\n;]/).map(p => p.trim()).filter(p => p.length > 3);
        parts.forEach(part => {
          counts[part] = (counts[part] || 0) + 1;
        });
      }
    }
  });
  
  return counts;
}

function extractTimePatterns(data: BehaviourData[]): {
  peakTime: string;
  peakTimeCount: number;
  peakDay: string;
  peakDayCount: number;
} {
  const timeCounts: Record<string, number> = {};
  const dayCounts: Record<string, number> = {
    'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0,
    'Thursday': 0, 'Friday': 0, 'Saturday': 0
  };

  data.forEach(item => {
    if (item.time) {
      const hour = new Date(`1970-01-01T${item.time}`).getHours();
      let timeOfDay = 'Night';
      if (hour >= 6 && hour < 12) timeOfDay = 'Morning';
      else if (hour >= 12 && hour < 20) timeOfDay = 'Evening';
      timeCounts[timeOfDay] = (timeCounts[timeOfDay] || 0) + 1;
    }
    
    if (item.date) {
      const date = new Date(item.date);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      if (dayCounts.hasOwnProperty(dayName)) {
        dayCounts[dayName]++;
      }
    }
  });

  const peakTime = Object.entries(timeCounts).sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';
  const peakTimeCount = Object.entries(timeCounts).sort(([,a], [,b]) => b - a)[0]?.[1] || 0;
  const peakDay = Object.entries(dayCounts).sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';
  const peakDayCount = Object.entries(dayCounts).sort(([,a], [,b]) => b - a)[0]?.[1] || 0;

  return { peakTime, peakTimeCount, peakDay, peakDayCount };
}

function calculateRecentTrend(data: BehaviourData[]): {
  direction: string;
  percentageChange: number;
} {
  if (data.length < 2) {
    return { direction: 'insufficient data', percentageChange: 0 };
  }

  const sortedData = [...data].sort((a, b) => {
    const dateA = new Date(a.date || 0).getTime();
    const dateB = new Date(b.date || 0).getTime();
    return dateA - dateB;
  });

  const firstThird = Math.floor(sortedData.length / 3);
  const lastThird = Math.floor(sortedData.length / 3);
  const firstPeriod = sortedData.slice(0, firstThird);
  const lastPeriod = sortedData.slice(-lastThird);

  const firstAvg = firstPeriod.length > 0 ? firstPeriod.length : 1;
  const lastAvg = lastPeriod.length > 0 ? lastPeriod.length : 1;
  
  const percentageChange = ((lastAvg - firstAvg) / firstAvg) * 100;
  
  let direction = 'stable';
  if (percentageChange > 10) direction = 'increasing';
  else if (percentageChange < -10) direction = 'decreasing';

  return { direction, percentageChange };
}

function getDateRange(data: BehaviourData[]): { start: string; end: string } {
  const dates = data
    .map(item => item.date ? new Date(item.date) : null)
    .filter((d): d is Date => d !== null && !isNaN(d.getTime()));

  if (dates.length === 0) {
    return { start: 'Unknown', end: 'Unknown' };
  }

  const start = new Date(Math.min(...dates.map(d => d.getTime())));
  const end = new Date(Math.max(...dates.map(d => d.getTime())));

  return {
    start: start.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    end: end.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  };
}

async function generateAIInsights(
  dataSummary: string,
  viewMode: string,
  residentName?: string
): Promise<{
  clinicalAssessment: string;
  recommendations: Array<{ priority: string; title: string; description: string; rationale: string }>;
  carePlanSuggestions: Array<{ category: string; suggestion: string; rationale: string }>;
  riskFactors: Array<{ factor: string; severity: string; recommendation: string }>;
  interventionEffectiveness: string;
}> {
  const systemPrompt = viewMode === 'personalized'
    ? `You are an experienced registered nurse (RN) specializing in long-term care and behavioural management for elderly residents. Your role is to analyze behavioural incident data and provide clinical insights, evidence-based recommendations, and personalized care plan suggestions.

Focus on:
- Clinical assessment of behavioural patterns
- Evidence-based intervention recommendations
- Risk factor identification and mitigation strategies
- Personalized care plan modifications
- Medication review considerations
- Staff training and environmental modifications
- Family communication strategies

Provide practical, actionable recommendations that a care team can implement immediately. Use nursing terminology and reference best practices in dementia care and responsive behaviours.`
    : `You are an experienced registered nurse (RN) specializing in long-term care facility management. Your role is to analyze facility-wide behavioural incident data and provide holistic insights, evidence-based recommendations, and system-level improvements.

Focus on:
- Facility-wide patterns and trends
- Resource allocation recommendations
- Staff training needs
- Environmental modifications
- Policy and procedure improvements
- Quality improvement initiatives
- Interdisciplinary team coordination

Provide practical, actionable recommendations that facility leadership can implement. Use nursing and healthcare management terminology.`;

  const userPrompt = `${dataSummary}

Based on this behavioural incident data, please provide:

1. CLINICAL ASSESSMENT (2-3 paragraphs):
   - Overall assessment of the behavioural patterns
   - Key clinical observations
   - Areas of concern or improvement

2. RECOMMENDATIONS (5-8 items, prioritized as High/Medium/Low):
   For each recommendation, provide:
   - Priority level (High/Medium/Low)
   - Title (brief, actionable)
   - Description (detailed, specific)
   - Rationale (evidence-based reason)

3. CARE PLAN SUGGESTIONS (4-6 items):
   For each suggestion, provide:
   - Category (e.g., "Environmental Modifications", "Medication Review", "Activity Programming", "Staff Training", "Family Engagement")
   - Suggestion (specific, actionable)
   - Rationale (why this helps)

4. RISK FACTORS (3-5 items):
   For each risk factor, provide:
   - Factor (specific risk identified)
   - Severity (High/Medium/Low)
   - Recommendation (how to address)

5. INTERVENTION EFFECTIVENESS (1-2 paragraphs):
   - Assessment of current interventions
   - Recommendations for improvement

Format your response as JSON with this exact structure:
{
  "clinicalAssessment": "...",
  "recommendations": [
    {
      "priority": "High|Medium|Low",
      "title": "...",
      "description": "...",
      "rationale": "..."
    }
  ],
  "carePlanSuggestions": [
    {
      "category": "...",
      "suggestion": "...",
      "rationale": "..."
    }
  ],
  "riskFactors": [
    {
      "factor": "...",
      "severity": "High|Medium|Low",
      "recommendation": "..."
    }
  ],
  "interventionEffectiveness": "..."
}

Respond ONLY with valid JSON, no additional text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    return parsed;

  } catch (error) {
    console.error('Error calling OpenAI:', error);
    // Return fallback insights if AI fails
    return {
      clinicalAssessment: 'Unable to generate AI assessment at this time. Please review the data manually.',
      recommendations: [],
      carePlanSuggestions: [],
      riskFactors: [],
      interventionEffectiveness: 'Unable to assess intervention effectiveness at this time.'
    };
  }
}


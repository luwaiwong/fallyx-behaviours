/**
 * Type definitions for extraction strategy configuration
 */

export interface PdfExtractionConfig {
  xTolerance: number;
  yTolerance: number;
  maxPages: number;
}

export interface NoteTypesConfig {
  typePattern: string; // Regex pattern for matching note types
  validTypes: string[]; // List of valid note types to extract
  skipPatterns: string[]; // Patterns to skip (e.g., comma-separated types)
}

export interface FollowUpNotesConfig {
  enabled: boolean;
  types: string[]; // Types to extract as follow-up notes
}

export interface ExcelProcessingConfig {
  headerRow: number;
  injuryColumnStart: number;
  injuryColumnEnd: number;
  units: string[];
  filterStruckOut: boolean;
}

export interface ContentCleaningConfig {
  removePatterns: string[]; // Regex patterns for headers/footers to remove
}

export interface AiProcessingConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  prompts?: {
    injuryDetection?: string;
    poaContact?: string;
    noteSummary?: string;
  };
}

export interface KinderaFeaturesConfig {
  filterBehaviourNotes: boolean;
  smartTruncate: boolean;
  truncationSettings?: {
    maxLength?: number;
    truncateAt?: string; // e.g., "Responsive Behaviour"
    keepAfter?: string; // e.g., "Behaviour Displayed:"
  };
}

export interface ExtractionStrategyConfig {
  pdfExtraction: PdfExtractionConfig;
  noteTypes: NoteTypesConfig;
  followUpNotes: FollowUpNotesConfig;
  excelProcessing: ExcelProcessingConfig;
  contentCleaning: ContentCleaningConfig;
  aiProcessing: AiProcessingConfig;
  kinderaFeatures?: KinderaFeaturesConfig;
}

// Strategy templates
export type StrategyTemplate = 'responsive' | 'kindera' | 'test' | 'custom';

// Predefined strategy templates
export const STRATEGY_TEMPLATES: Record<StrategyTemplate, Partial<ExtractionStrategyConfig>> = {
  responsive: {
    pdfExtraction: {
      xTolerance: 3,
      yTolerance: 3,
      maxPages: 500,
    },
    noteTypes: {
      typePattern: "Type:\\s*(Behaviour - Responsive Behaviour|Family/Resident Involvement|Physician Note|Behaviour - Follow up)",
      validTypes: [
        'Behaviour - Responsive Behaviour',
        'Family/Resident Involvement',
        'Physician Note',
        'Behaviour - Follow up',
      ],
      skipPatterns: ['Type: Behaviour - Follow up, Behaviour - Responsive Behaviour'],
    },
    followUpNotes: {
      enabled: true,
      types: ['Behaviour - Follow up'],
    },
    excelProcessing: {
      headerRow: 7,
      injuryColumnStart: 13,
      injuryColumnEnd: 87,
      units: [
        'Gage North', 'Gage West', 'Lawrence',
        'Ground W', '2 East', '2 West', '3 East', '3 West',
        'Shaw', 'Shaw Two', 'Shaw Three',
        'Pinery', 'Pinery Two', 'Pinery Three',
        'Wellington', 'Gage',
        'Floor 1', 'Floor 2', 'Floor 3', 'Floor 4',
      ],
      filterStruckOut: true,
    },
    contentCleaning: {
      removePatterns: [
        '^(Facility #|Date:|Time:|Primary Physician:|User:|Progress Notes|Admission|Date of Birth|Gender|Allergies|Diagnoses|Location|Medical Record #|Physician|Pharmacy|Page \\d+ of \\d+|Author:|Signature:)',
      ],
    },
    aiProcessing: {
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      maxTokens: 1000,
    },
  },
  kindera: {
    pdfExtraction: {
      xTolerance: 1,
      yTolerance: 1,
      maxPages: 500,
    },
    noteTypes: {
      typePattern: "Type:\\s*(Responsive Behaviour - Physical Agression|Responsive Behaviour - Verbal|Responsive Behaviour - Potential to harm self|Responsive Behaviour - Wandering|Responsive Behaviours - Other|Behaviour - Responsive Behaviour|Family/Resident Involvement|Physician Note|Behaviour - Follow up|Responsive Behaviour Assessment Summary|Behaviour Note)",
      validTypes: [
        'Responsive Behaviour - Physical Agression',
        'Responsive Behaviour - Verbal',
        'Responsive Behaviour - Potential to harm self',
        'Responsive Behaviour - Wandering',
        'Responsive Behaviours - Other',
        'Behaviour - Responsive Behaviour',
        'Family/Resident Involvement',
        'Physician Note',
        'Behaviour - Follow up',
        'Responsive Behaviour Assessment Summary',
        'Behaviour Note',
      ],
      skipPatterns: ['Type: Behaviour Note, Responsive Behaviour'],
    },
    followUpNotes: {
      enabled: true,
      types: ['Behaviour - Follow up', 'Behaviour Note'],
    },
    excelProcessing: {
      headerRow: 7,
      injuryColumnStart: 13,
      injuryColumnEnd: 34,
      units: [
        'Gage North', 'Gage West', 'Lawrence',
        'Ground W', '2 East', '2 West', '3 East', '3 West',
        'Shaw', 'Shaw Two', 'Shaw Three',
        'Pinery', 'Pinery Two', 'Pinery Three',
        'Wellington', 'Gage',
        'Floor 1', 'Floor 2', 'Floor 3', 'Floor 4',
      ],
      filterStruckOut: true,
    },
    contentCleaning: {
      removePatterns: [
        '^(Facility #|Date:|Time:|Primary Physician:|User:|Progress Notes|Admission|Date of Birth|Gender|Allergies|Diagnoses|Location|Medical Record #|Physician|Pharmacy|Page \\d+ of \\d+|Author:|Signature:)',
      ],
    },
    aiProcessing: {
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      maxTokens: 1000,
    },
    kinderaFeatures: {
      filterBehaviourNotes: true,
      smartTruncate: true,
      truncationSettings: {
        truncateAt: 'Responsive Behaviour',
        keepAfter: 'Behaviour Displayed :',
      },
    },
  },
  test: {
    pdfExtraction: {
      xTolerance: 3,
      yTolerance: 3,
      maxPages: 300,
    },
    noteTypes: {
      typePattern: "Type:\\s*(Behaviour Note)",
      validTypes: ['Behaviour Note'],
      skipPatterns: [],
    },
    followUpNotes: {
      enabled: false,
      types: [],
    },
    excelProcessing: {
      headerRow: 7,
      injuryColumnStart: 13,
      injuryColumnEnd: 34,
      units: [],
      filterStruckOut: true,
    },
    contentCleaning: {
      removePatterns: [
        '^(Facility #|Date:|Time:|Primary Physician:|User:|Progress Notes|Admission|Date of Birth|Gender|Allergies|Diagnoses|Location|Medical Record #|Physician|Pharmacy|Page \\d+ of \\d+|Author:|Signature:)',
      ],
    },
    aiProcessing: {
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      maxTokens: 500,
    },
  },
  custom: {
    // Empty template - user fills in all fields
  },
};


'use client';

import { useState, useEffect } from 'react';
import HelpIcon from './HelpIcon';
import { ExtractionStrategyConfig, StrategyTemplate, STRATEGY_TEMPLATES } from '@/types/extractionStrategy';

interface CustomStrategyFormProps {
  onSave: (config: ExtractionStrategyConfig) => void;
  onCancel: () => void;
  initialTemplate?: StrategyTemplate;
}

export default function CustomStrategyForm({ onSave, onCancel, initialTemplate = 'custom' }: CustomStrategyFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<StrategyTemplate>(initialTemplate);
  const [config, setConfig] = useState<ExtractionStrategyConfig>(() => {
    const template = STRATEGY_TEMPLATES[initialTemplate] || {};
    return {
      pdfExtraction: {
        xTolerance: template.pdfExtraction?.xTolerance || 3,
        yTolerance: template.pdfExtraction?.yTolerance || 3,
        maxPages: template.pdfExtraction?.maxPages || 500,
      },
      noteTypes: {
        typePattern: template.noteTypes?.typePattern || '',
        validTypes: template.noteTypes?.validTypes || [],
        skipPatterns: template.noteTypes?.skipPatterns || [],
      },
      followUpNotes: {
        enabled: template.followUpNotes?.enabled || false,
        types: template.followUpNotes?.types || [],
      },
      excelProcessing: {
        headerRow: template.excelProcessing?.headerRow || 7,
        injuryColumnStart: template.excelProcessing?.injuryColumnStart || 13,
        injuryColumnEnd: template.excelProcessing?.injuryColumnEnd || 34,
        units: template.excelProcessing?.units || [],
        filterStruckOut: template.excelProcessing?.filterStruckOut ?? true,
      },
      contentCleaning: {
        removePatterns: template.contentCleaning?.removePatterns || [
          '^(Facility #|Date:|Time:|Primary Physician:|User:|Progress Notes|Admission|Date of Birth|Gender|Allergies|Diagnoses|Location|Medical Record #|Physician|Pharmacy|Page \\d+ of \\d+|Author:|Signature:)',
        ],
      },
      aiProcessing: {
        model: template.aiProcessing?.model || 'gpt-3.5-turbo',
        temperature: template.aiProcessing?.temperature || 0.3,
        maxTokens: template.aiProcessing?.maxTokens || 1000,
      },
      kinderaFeatures: template.kinderaFeatures ? {
        filterBehaviourNotes: template.kinderaFeatures.filterBehaviourNotes || false,
        smartTruncate: template.kinderaFeatures.smartTruncate || false,
        truncationSettings: template.kinderaFeatures.truncationSettings,
      } : undefined,
    };
  });

  // Update config when template changes
  useEffect(() => {
    if (selectedTemplate !== 'custom') {
      const template = STRATEGY_TEMPLATES[selectedTemplate];
      if (template) {
        setConfig(prev => ({
          ...prev,
          ...template,
          pdfExtraction: { ...prev.pdfExtraction, ...template.pdfExtraction },
          noteTypes: { ...prev.noteTypes, ...template.noteTypes },
          followUpNotes: { ...prev.followUpNotes, ...template.followUpNotes },
          excelProcessing: { ...prev.excelProcessing, ...template.excelProcessing },
          contentCleaning: { ...prev.contentCleaning, ...template.contentCleaning },
          aiProcessing: { ...prev.aiProcessing, ...template.aiProcessing },
          kinderaFeatures: template.kinderaFeatures ? {
            ...prev.kinderaFeatures,
            ...template.kinderaFeatures,
          } : prev.kinderaFeatures,
        }));
      }
    }
  }, [selectedTemplate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config);
  };

  const addNoteType = () => {
    const newType = prompt('Enter note type:');
    if (newType && !config.noteTypes.validTypes.includes(newType)) {
      setConfig(prev => ({
        ...prev,
        noteTypes: {
          ...prev.noteTypes,
          validTypes: [...prev.noteTypes.validTypes, newType],
        },
      }));
    }
  };

  const removeNoteType = (type: string) => {
    setConfig(prev => ({
      ...prev,
      noteTypes: {
        ...prev.noteTypes,
        validTypes: prev.noteTypes.validTypes.filter(t => t !== type),
      },
    }));
  };

  const addUnit = () => {
    const newUnit = prompt('Enter unit/building name:');
    if (newUnit && !config.excelProcessing.units.includes(newUnit)) {
      setConfig(prev => ({
        ...prev,
        excelProcessing: {
          ...prev.excelProcessing,
          units: [...prev.excelProcessing.units, newUnit],
        },
      }));
    }
  };

  const removeUnit = (unit: string) => {
    setConfig(prev => ({
      ...prev,
      excelProcessing: {
        ...prev.excelProcessing,
        units: prev.excelProcessing.units.filter(u => u !== unit),
      },
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-gray-900">Custom Extraction Strategy</h4>
        <HelpIcon 
          title="Custom Extraction Strategy"
          content="Configure a custom extraction strategy for processing PDF and Excel files. You can start with a template (Responsive, Kindera, Test) and customize it, or build from scratch."
        />
      </div>

      {/* Template Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Start with Template
        </label>
        <select
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value as StrategyTemplate)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="custom">Custom (Start from scratch)</option>
          <option value="responsive">Responsive (Millcreek/Oneill style)</option>
          <option value="kindera">Kindera (Berkshire style)</option>
          <option value="test">Test (Development)</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Select a template to pre-fill common settings, then customize as needed
        </p>
      </div>

      {/* PDF Extraction Settings */}
      <div className="border-t pt-4">
        <h5 className="text-md font-medium text-gray-900 mb-3">PDF Extraction Settings</h5>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">X Tolerance</label>
            <input
              type="number"
              min="1"
              max="10"
              value={config.pdfExtraction.xTolerance}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                pdfExtraction: { ...prev.pdfExtraction, xTolerance: parseInt(e.target.value) || 3 },
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Y Tolerance</label>
            <input
              type="number"
              min="1"
              max="10"
              value={config.pdfExtraction.yTolerance}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                pdfExtraction: { ...prev.pdfExtraction, yTolerance: parseInt(e.target.value) || 3 },
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Pages</label>
            <input
              type="number"
              min="1"
              max="1000"
              value={config.pdfExtraction.maxPages}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                pdfExtraction: { ...prev.pdfExtraction, maxPages: parseInt(e.target.value) || 500 },
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Note Types Configuration */}
      <div className="border-t pt-4">
        <h5 className="text-md font-medium text-gray-900 mb-3">Note Types</h5>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type Pattern (Regex)</label>
            <input
              type="text"
              value={config.noteTypes.typePattern}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                noteTypes: { ...prev.noteTypes, typePattern: e.target.value },
              }))}
              placeholder='e.g., Type:\s*(Behaviour Note|Follow up)'
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">Regex pattern to match note types in PDF</p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Valid Note Types</label>
              <button
                type="button"
                onClick={addNoteType}
                className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                + Add Type
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {config.noteTypes.validTypes.map((type, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {type}
                  <button
                    type="button"
                    onClick={() => removeNoteType(type)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
              {config.noteTypes.validTypes.length === 0 && (
                <span className="text-sm text-gray-400">No types added</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Follow-up Notes */}
      <div className="border-t pt-4">
        <h5 className="text-md font-medium text-gray-900 mb-3">Follow-up Notes</h5>
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.followUpNotes.enabled}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                followUpNotes: { ...prev.followUpNotes, enabled: e.target.checked },
              }))}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Enable Follow-up Notes</span>
          </label>
          {config.followUpNotes.enabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Types</label>
              <select
                multiple
                value={config.followUpNotes.types}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setConfig(prev => ({
                    ...prev,
                    followUpNotes: { ...prev.followUpNotes, types: selected },
                  }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                size={Math.min(config.noteTypes.validTypes.length, 5)}
              >
                {config.noteTypes.validTypes.map((type, idx) => (
                  <option key={idx} value={type}>{type}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">Hold Ctrl/Cmd to select multiple types</p>
            </div>
          )}
        </div>
      </div>

      {/* Excel Processing */}
      <div className="border-t pt-4">
        <h5 className="text-md font-medium text-gray-900 mb-3">Excel Processing</h5>
        <div className="grid grid-cols-4 gap-4 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Header Row</label>
            <input
              type="number"
              min="0"
              value={config.excelProcessing.headerRow}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                excelProcessing: { ...prev.excelProcessing, headerRow: parseInt(e.target.value) || 7 },
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Injury Start</label>
            <input
              type="number"
              min="0"
              value={config.excelProcessing.injuryColumnStart}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                excelProcessing: { ...prev.excelProcessing, injuryColumnStart: parseInt(e.target.value) || 13 },
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Injury End</label>
            <input
              type="number"
              min="0"
              value={config.excelProcessing.injuryColumnEnd}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                excelProcessing: { ...prev.excelProcessing, injuryColumnEnd: parseInt(e.target.value) || 34 },
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="flex items-center mt-6">
              <input
                type="checkbox"
                checked={config.excelProcessing.filterStruckOut}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  excelProcessing: { ...prev.excelProcessing, filterStruckOut: e.target.checked },
                }))}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Filter Struck Out</span>
            </label>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Units/Buildings</label>
            <button
              type="button"
              onClick={addUnit}
              className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              + Add Unit
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.excelProcessing.units.map((unit, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
              >
                {unit}
                <button
                  type="button"
                  onClick={() => removeUnit(unit)}
                  className="ml-2 text-green-600 hover:text-green-800"
                >
                  ×
                </button>
              </span>
            ))}
            {config.excelProcessing.units.length === 0 && (
              <span className="text-sm text-gray-400">No units added</span>
            )}
          </div>
        </div>
      </div>

      {/* AI Processing */}
      <div className="border-t pt-4">
        <h5 className="text-md font-medium text-gray-900 mb-3">AI Processing</h5>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <select
              value={config.aiProcessing.model}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                aiProcessing: { ...prev.aiProcessing, model: e.target.value },
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={config.aiProcessing.temperature}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                aiProcessing: { ...prev.aiProcessing, temperature: parseFloat(e.target.value) || 0.3 },
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
            <input
              type="number"
              min="1"
              max="4000"
              value={config.aiProcessing.maxTokens}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                aiProcessing: { ...prev.aiProcessing, maxTokens: parseInt(e.target.value) || 1000 },
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Kindera Features (Optional) */}
      <div className="border-t pt-4">
        <h5 className="text-md font-medium text-gray-900 mb-3">Advanced Features (Kindera-style)</h5>
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.kinderaFeatures?.filterBehaviourNotes || false}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                kinderaFeatures: {
                  filterBehaviourNotes: e.target.checked,
                  smartTruncate: e.target.checked ? (prev.kinderaFeatures?.smartTruncate || false) : false,
                  truncationSettings: prev.kinderaFeatures?.truncationSettings,
                },
              }))}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Enable Behaviour Note Filtering</span>
          </label>
          {config.kinderaFeatures?.filterBehaviourNotes && (
            <>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.kinderaFeatures?.smartTruncate || false}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    kinderaFeatures: {
                      filterBehaviourNotes: prev.kinderaFeatures?.filterBehaviourNotes ?? false,
                      smartTruncate: e.target.checked,
                      truncationSettings: e.target.checked ? {
                        truncateAt: 'Responsive Behaviour',
                        keepAfter: 'Behaviour Displayed :',
                      } : undefined,
                    },
                  }))}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Enable Smart Truncation</span>
              </label>
              {config.kinderaFeatures?.smartTruncate && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Truncate At</label>
                    <input
                      type="text"
                      value={config.kinderaFeatures?.truncationSettings?.truncateAt || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        kinderaFeatures: {
                          filterBehaviourNotes: prev.kinderaFeatures?.filterBehaviourNotes ?? false,
                          smartTruncate: prev.kinderaFeatures?.smartTruncate ?? false,
                          truncationSettings: {
                            ...prev.kinderaFeatures?.truncationSettings,
                            truncateAt: e.target.value,
                          },
                        },
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      placeholder="Responsive Behaviour"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Keep After</label>
                    <input
                      type="text"
                      value={config.kinderaFeatures?.truncationSettings?.keepAfter || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        kinderaFeatures: {
                          filterBehaviourNotes: prev.kinderaFeatures?.filterBehaviourNotes ?? false,
                          smartTruncate: prev.kinderaFeatures?.smartTruncate ?? false,
                          truncationSettings: {
                            ...prev.kinderaFeatures?.truncationSettings,
                            keepAfter: e.target.value,
                          },
                        },
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      placeholder="Behaviour Displayed :"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-medium transition-colors"
        >
          Save Strategy
        </button>
      </div>
    </form>
  );
}


'use client';

import { useState, useEffect } from 'react';

export default function FileUpload() {
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [excelFiles, setExcelFiles] = useState<File[]>([]);
  const [selectedHome, setSelectedHome] = useState('');
  const [homes, setHomes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHomes, setLoadingHomes] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchHomes = async () => {
      try {
        setLoadingHomes(true);
        const response = await fetch('/api/admin/homes');
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error response:', response.status, errorText);
          throw new Error(`Failed to fetch homes: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          setHomes(data.homes);
          
          if (data.homes.length === 0) {
            setMessage('No homes found. Please ensure homes are configured.');
          }
        } else {
          setMessage(`Error loading homes: ${data.error}`);
        }
      } catch (error) {
        setMessage(`Error loading homes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoadingHomes(false);
      }
    };

    fetchHomes();
  }, []);

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPdfFiles(files);
    }
  };

  const handleExcelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setExcelFiles(files);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (pdfFiles.length === 0 || excelFiles.length === 0 || !selectedHome) {
      setMessage('Please select at least one PDF file, one Excel file, and a home');
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      
      pdfFiles.forEach((file, index) => {
        formData.append(`pdf_${index}`, file);
      });
      
      excelFiles.forEach((file, index) => {
        formData.append(`excel_${index}`, file);
      });
      
      formData.append('home', selectedHome);
      formData.append('pdfCount', pdfFiles.length.toString());
      formData.append('excelCount', excelFiles.length.toString());

      const response = await fetch('/api/admin/process-behaviours', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setMessage('Files processed successfully!');
        setPdfFiles([]);
        setExcelFiles([]);
        setSelectedHome('');
        const pdfInput = document.getElementById('pdf') as HTMLInputElement;
        const excelInput = document.getElementById('excel') as HTMLInputElement;
        if (pdfInput) pdfInput.value = '';
        if (excelInput) excelInput.value = '';
      } else {
        setMessage(`Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-base leading-6 font-medium text-gray-900 mb-6">
          Upload Behaviour Files
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="pdf" className="block text-sm font-medium text-gray-700">
              Behaviour Notes PDF
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="pdf"
                    className="relative cursor-pointer bg-white rounded-md font-medium focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2"
                    style={{ color: '#0cc7ed' }}
                    onMouseEnter={(e) => (e.target as HTMLLabelElement).style.color = '#0aa8c7'}
                    onMouseLeave={(e) => (e.target as HTMLLabelElement).style.color = '#0cc7ed'}
                  >
                    <span>Upload a file</span>
                    <input
                      id="pdf"
                      name="pdf"
                      type="file"
                      accept=".pdf"
                      multiple
                      className="sr-only"
                      onChange={handlePdfChange}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PDF files only</p>
              </div>
            </div>
            {pdfFiles.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-green-600 font-medium">Selected {pdfFiles.length} file(s):</p>
                <ul className="mt-1 text-sm text-gray-600">
                  {pdfFiles.map((file, index) => (
                    <li key={index} className="truncate">• {file.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="excel" className="block text-sm font-medium text-gray-700">
              Incident Report Excel
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="excel"
                    className="relative cursor-pointer bg-white rounded-md font-medium focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2"
                    style={{ color: '#0cc7ed' }}
                    onMouseEnter={(e) => (e.target as HTMLLabelElement).style.color = '#0aa8c7'}
                    onMouseLeave={(e) => (e.target as HTMLLabelElement).style.color = '#0cc7ed'}
                  >
                    <span>Upload a file</span>
                    <input
                      id="excel"
                      name="excel"
                      type="file"
                      accept=".xls,.xlsx"
                      multiple
                      className="sr-only"
                      onChange={handleExcelChange}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">Excel files only</p>
              </div>
            </div>
            {excelFiles.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-green-600 font-medium">Selected {excelFiles.length} file(s):</p>
                <ul className="mt-1 text-sm text-gray-600">
                  {excelFiles.map((file, index) => (
                    <li key={index} className="truncate">• {file.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="home" className="block text-sm font-medium text-gray-700">
              Select Home
            </label>
            <select
              id="home"
              name="home"
              value={selectedHome}
              onChange={(e) => setSelectedHome(e.target.value)}
              disabled={loadingHomes}
              className="mt-1 block w-full px-4 py-3 text-gray-900 border-gray-300 rounded-md shadow-sm text-base bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              style={{ 
                '--tw-ring-color': '#0cc7ed',
                '--tw-border-color': '#0cc7ed'
              } as React.CSSProperties}
              onFocus={(e) => {
                (e.target as HTMLSelectElement).style.borderColor = '#0cc7ed';
                (e.target as HTMLSelectElement).style.boxShadow = '0 0 0 3px rgba(12, 199, 237, 0.1)';
              }}
              onBlur={(e) => {
                (e.target as HTMLSelectElement).style.borderColor = '#d1d5db';
                (e.target as HTMLSelectElement).style.boxShadow = 'none';
              }}
            >
              <option value="">
                {loadingHomes ? 'Loading homes...' : 'Select a home...'}
              </option>
              {homes.map((home) => (
                <option key={home} value={home}>
                  {home}
                </option>
              ))}
            </select>
            {homes.length === 0 && !loadingHomes && (
              <p className="mt-1 text-sm text-amber-600">
                No homes found. Please create homes first.
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || loadingHomes || pdfFiles.length === 0 || excelFiles.length === 0 || !selectedHome}
              className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
              style={{ backgroundColor: '#0cc7ed' }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = '#0aa8c7';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = '#0cc7ed';
                }
              }}
            >
              {loading ? 'Processing...' : 'Process Files'}
            </button>
          </div>

          {message && (
            <div className={`text-sm ${message.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}


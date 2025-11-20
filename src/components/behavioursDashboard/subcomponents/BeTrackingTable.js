import React, { useState, useEffect, Fragment} from 'react';

const BeTrackingTable = ({filteredData, cleanDuplicateText, storageKey = 'behaviours_checked_items'}) => {
    const [selectedItem, setSelectedItem] = useState(null);
    const [expandedNotes, setExpandedNotes] = useState({});

    // Load selected item from localStorage on component mount
    useEffect(() => {
        try {
            const savedSelectedItem = localStorage.getItem(storageKey);
            if (savedSelectedItem) {
                setSelectedItem(savedSelectedItem);
            }
        } catch (error) {
            console.error('Error loading selected item from localStorage:', error);
        }
    }, [storageKey]);

    // Save selected item to localStorage whenever it changes
    useEffect(() => {
        try {
            if (selectedItem) {
                localStorage.setItem(storageKey, selectedItem);
            } else {
                localStorage.removeItem(storageKey);
            }
        } catch (error) {
            console.error('Error saving selected item to localStorage:', error);
        }
    }, [selectedItem, storageKey]);

    // Handle radio button change (single selection)
    const handleRadioChange = (incidentNumber) => {
        setSelectedItem(selectedItem === incidentNumber ? null : incidentNumber);
    };

    // Toggle expanded state for a specific note
    const toggleExpanded = (incidentNumber) => {
        setExpandedNotes(prev => ({
            ...prev,
            [incidentNumber]: !prev[incidentNumber]
        }));
    };

    return (
        <div style={s.tableContainer}>
            <table style={s.table}>
                <thead>
                    <tr>
                        <th style={{ ...s.tableHeader, ...s.radioHeader }}></th>
                        <th style={s.tableHeader}>#</th>
                        <th style={s.tableHeader}>Name</th>
                        <th style={s.tableHeader}>Date</th>
                        <th style={s.tableHeader}>Location</th>
                        <th style={s.tableHeader}>Type</th>
                        <th style={s.tableHeader}>Who Affected</th>
                        <th style={s.tableHeader}>PRN</th>
                        <th style={s.tableHeader}>Code White</th>
                        <th style={s.tableHeader}>Summary</th>
                        <th style={s.tableHeader}>Triggers</th>
                        <th style={s.tableHeader}>Interventions</th>
                        <th style={s.tableHeader}>Injuries</th>
                        <th style={{ ...s.tableHeader, ...s.lastHeader }}>Potential CI</th>
                        {/* Conditionally render Other Notes header if any item has other_notes */}
                        {filteredData && filteredData.some(item => item.other_notes) && (
                            <th style={{ ...s.tableHeader, ...s.lastHeader }}>Other Notes</th>
                        )}
                    </tr>
                </thead>
                <tbody id="fallsTableBody">
                    {filteredData && filteredData.map((item, i) => {
                        const isSelected = selectedItem === item.incident_number;

                        // Compliance check: Highlight red if "No Progress" and "24hrs of RIM" are found
                        const summaryText = item.summary || '';
                        const triggersText = cleanDuplicateText(item.triggers, 'triggers') || '';
                        const interventionsText = cleanDuplicateText(item.interventions, 'interventions') || '';
                        
                        const summaryHasCompliance = summaryText.includes('No Progress') && summaryText.includes('24hrs of RIM');
                        const triggersHasCompliance = triggersText.includes('No Progress') && triggersText.includes('24hrs of RIM');
                        const interventionsHasCompliance = interventionsText.includes('No Progress') && interventionsText.includes('24hrs of RIM');

                        // Strikethrough style for selected rows
                        const strikethroughStyle = isSelected ? { textDecoration: 'line-through', opacity: 0.6 } : {};

                        return (
                            <tr key={i} style={s.tableRow}>
                                <td 
                                    style={{ ...s.tableCell, ...s.radioCell }}
                                    onClick={() => handleRadioChange(item.incident_number)}
                                >
                                    <input
                                        type="radio"
                                        name="table-selection"
                                        checked={isSelected}
                                        onChange={() => handleRadioChange(item.incident_number)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRadioChange(item.incident_number);
                                        }}
                                        style={s.radioInput}
                                    />
                                </td>
                                <td style={{ ...s.tableCell, ...strikethroughStyle }}>{item.incident_number}</td>
                                <td style={{ ...s.tableCell, ...strikethroughStyle }}>{item.name}</td>
                                <td style={{ ...s.tableCell, ...strikethroughStyle }}>{item.date}</td>
                                <td style={{ ...s.tableCell, ...strikethroughStyle }}>{item.incident_location}</td>
                                <td style={{ ...s.tableCell, ...strikethroughStyle }}>{item.incident_type}</td>
                                <td style={{ ...s.tableCell, ...strikethroughStyle }}>{item.who_affected}</td>
                                <td style={{ ...s.tableCell, ...strikethroughStyle }}>{item.prn}</td>
                                <td style={{ ...s.tableCell, ...strikethroughStyle }}>{item.code_white}</td>
                                <td style={{ ...s.tableCell, ...(summaryHasCompliance ? s.highlightRed : {}), ...strikethroughStyle }}>{item.summary}</td>
                                <td style={{ ...s.tableCell, ...(triggersHasCompliance ? s.highlightRed : {}), ...strikethroughStyle }}>{triggersText}</td>
                                <td style={{ ...s.tableCell, ...(interventionsHasCompliance ? s.highlightRed : {}), ...strikethroughStyle }}>{interventionsText}</td>
                                <td style={{ ...s.tableCell, ...strikethroughStyle }}>{item.injuries}</td>
                                <td style={{ ...s.tableCell, ...(filteredData && !filteredData.some(dataItem => dataItem.other_notes) ? s.lastCell : {}), ...strikethroughStyle }}>{item.CI || "Still Gathering Data/Unknown"}</td>
                                {/* Conditionally render Other Notes cell if any item has other_notes */}
                                {filteredData && filteredData.some(dataItem => dataItem.other_notes) && (
                                    <td style={{ ...s.tableCell, ...s.lastCell, whiteSpace: 'pre-wrap', ...strikethroughStyle }}>
                                        {item.other_notes ? 
                                            (() => {
                                                const cleanedText = item.other_notes
                                                    .replace(/<br\s*\/?>/gi, '\n')
                                                    .replace(/note text\s*:\s*/gi, '')
                                                    .replace(/202[4-5]-/g, '');
                                                
                                                const expanded = expandedNotes[item.incident_number] || false;
                                                const maxLength = 200;
                                                const shouldTruncate = cleanedText.length > maxLength;
                                                const displayText = expanded || !shouldTruncate ? cleanedText : cleanedText.slice(0, maxLength) + '...';
                                                
                                                return (
                                                    <div style={{ cursor: 'pointer', position: 'relative', zIndex: 10 }} onClick={() => toggleExpanded(item.incident_number)}>
                                                        {displayText
                                                        }

                                                    <br/>   
                                                        {shouldTruncate && (
                                                            <>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleExpanded(item.incident_number);
                                                                    }}
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        color: '#007bff',
                                                                        cursor: 'pointer',
                                                                        textDecoration: 'underline',
                                                                        padding: 0,
                                                                        fontSize: '12px',
                                                                        position: 'relative',
                                                                        zIndex: 10
                                                                    }}
                                                                >
                                                                    {expanded ? 'Show less' : 'Show more'}
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })()
                                            : ''
                                        }
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const s = {
    tableContainer: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: '8px',
        overflowX: 'auto',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb',
    },
    table: {
        width: '100%',
        borderCollapse: 'separate',
        borderSpacing: 0,
        fontSize: '14px',
        tableLayout: 'auto',
        backgroundColor: '#fff',
    },
    tableHeader: {
        borderRight: '1px solid #e5e7eb',
        borderBottom: '2px solid #e5e7eb',
        borderTop: 'none',
        borderLeft: 'none',
        padding: '12px 16px',
        textAlign: 'left',
        backgroundColor: '#f9fafb',
        fontWeight: '600',
        fontSize: '14px',
        color: '#374151',
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
    },
    radioHeader: {
        textAlign: 'center',
        width: '50px',
        padding: '12px 8px',
        borderLeft: '1px solid #e5e7eb',
    },
    tableRow: {
        backgroundColor: '#fff',
        borderBottom: '1px solid #e5e7eb',
    },
    tableCell: {
        borderRight: '1px solid #e5e7eb',
        borderBottom: '1px solid #d1d5db',
        borderLeft: 'none',
        borderTop: 'none',
        padding: '12px 16px',
        textAlign: 'left',
        fontSize: '14px',
        color: '#1f2937',
        verticalAlign: 'middle',
        lineHeight: '1.5',
    },
    radioCell: {
        textAlign: 'center',
        width: '50px',
        padding: '12px 8px',
        verticalAlign: 'middle',
        borderLeft: '1px solid #e5e7eb',
        borderRight: '1px solid #e5e7eb',
        borderBottom: '1px solid #d1d5db',
        cursor: 'pointer',
    },
    radioInput: {
        width: '18px',
        height: '18px',
        cursor: 'pointer',
        verticalAlign: 'middle',
        accentColor: '#06b6d4',
    },
    lastHeader: {
        borderRight: '1px solid #e5e7eb',
    },
    lastCell: {
        borderRight: '1px solid #e5e7eb',
    },
    highlightRed: {
        backgroundColor: '#ffcdd2',
    },
};

export default BeTrackingTable;
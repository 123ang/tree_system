import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { TreeStructure } from '../types/api';

interface TreeViewerProps {
  tree: TreeStructure | null;
  onNodeClick?: (nodeId: number) => void;
  maxDepth?: number;
}

const TreeViewer: React.FC<TreeViewerProps> = ({ tree, onNodeClick, maxDepth = 3 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current || !tree) return;

    // Initialize Cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      elements: convertTreeToCytoscape(tree),
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#007bff',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': 'white',
            'font-size': '10px',
            'width': '60px',
            'height': '60px',
            'border-width': 2,
            'border-color': '#0056b3',
            'text-wrap': 'wrap',
            'text-max-width': '50px'
          }
        },
        {
          selector: 'node:selected',
          style: {
            'background-color': '#28a745',
            'border-color': '#1e7e34',
            'border-width': 3
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#ccc',
            'target-arrow-color': '#ccc',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier'
          }
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#007bff',
            'target-arrow-color': '#007bff',
            'width': 3
          }
        }
      ],
      layout: {
        name: 'breadthfirst',
        directed: true,
        roots: `#node-${tree.id}`,
        spacingFactor: 1.5,
        avoidOverlap: true,
        nodeDimensionsIncludeLabels: true
      },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      selectionType: 'single'
    });

    cyRef.current = cy;

    // Add click handler
    cy.on('tap', 'node', (event) => {
      const node = event.target;
      const nodeId = parseInt(node.id().replace('node-', ''));
      if (onNodeClick) {
        onNodeClick(nodeId);
      }
    });

    // Fit to viewport with padding
    cy.fit(undefined, 50); // 50px padding on all sides

    return () => {
      cy.destroy();
    };
  }, [tree, onNodeClick]);

  const convertTreeToCytoscape = (tree: TreeStructure): cytoscape.ElementDefinition[] => {
    const elements: cytoscape.ElementDefinition[] = [];
    const visited = new Set<number>();

    const addNode = (node: TreeStructure) => {
      if (visited.has(node.id)) return;
      visited.add(node.id);

      const label = node.wallet_address;
      
      elements.push({
        data: {
          id: `node-${node.id}`,
          label: label,
          wallet: node.wallet_address,
          position: node.position,
          depth: node.depth,
          activation_sequence: node.activation_sequence,
          total_nft_claimed: node.total_nft_claimed
        }
      });

      // Add children
      node.children.forEach(child => {
        addNode(child);
        elements.push({
          data: {
            id: `edge-${node.id}-${child.id}`,
            source: `node-${node.id}`,
            target: `node-${child.id}`
          }
        });
      });
    };

    addNode(tree);
    return elements;
  };

  const handleZoomIn = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 1.2);
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 0.8);
    }
  };

  const handleFit = () => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 50); // Fit with 50px padding
    }
  };

  const handleExport = async () => {
    if (!cyRef.current) return;
    
    try {
      // First, fit the diagram with padding
      cyRef.current.fit(undefined, 50);
      
      // Wait for layout to settle
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Export as PNG using Cytoscape's built-in export
      const png64 = cyRef.current.png({
        output: 'base64',
        full: true, // Include all nodes even if outside viewport
        bg: 'white',
        scale: 2 // Higher resolution for screenshot
      });
      
      // Create download link
      const link = document.createElement('a');
      link.download = `tree-diagram-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = 'data:image/png;base64,' + png64;
      link.click();
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export diagram. Please try again.');
    }
  };

  const handleExportPDF = async () => {
    if (!cyRef.current) return;
    
    try {
      // First, fit the diagram with padding
      cyRef.current.fit(undefined, 50);
      
      // Wait for layout to settle
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Export as PNG first (base64)
      const png64 = cyRef.current.png({
        output: 'base64',
        full: true,
        bg: 'white',
        scale: 2
      });
      
      // Load jsPDF dynamically
      const jsPDF = (await import('jspdf')).default;
      
      // Create PDF document
      const pdf = new jsPDF({
        orientation: 'landscape', // Use landscape for tree diagrams
        unit: 'px',
        format: [1920, 1080] // Default size, will adjust to image
      });
      
      // Convert base64 PNG to image
      const img = new Image();
      img.src = 'data:image/png;base64,' + png64;
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          try {
            // Calculate dimensions to fit PDF page
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = img.width;
            const imgHeight = img.height;
            
            // Calculate scaling to fit page
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const scaledWidth = imgWidth * ratio;
            const scaledHeight = imgHeight * ratio;
            
            // Center the image on the page
            const xOffset = (pdfWidth - scaledWidth) / 2;
            const yOffset = (pdfHeight - scaledHeight) / 2;
            
            // Add image to PDF
            pdf.addImage(png64, 'PNG', xOffset, yOffset, scaledWidth, scaledHeight);
            
            // Save PDF
            pdf.save(`tree-diagram-${new Date().toISOString().slice(0, 10)}.pdf`);
            resolve();
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = reject;
      });
    } catch (error) {
      console.error('PDF export error:', error);
      // Fallback: try using browser's print to PDF
      alert('PDF export failed. Try using browser Print (Ctrl+P) and Save as PDF option.');
    }
  };

  if (!tree) {
    return (
      <div className="tree-container">
        <div className="loading">No tree data available</div>
      </div>
    );
  }

  return (
    <div className="tree-container">
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', gap: '5px' }}>
        <button className="btn btn-secondary" onClick={handleZoomIn} style={{ marginRight: 0 }}>
          +
        </button>
        <button className="btn btn-secondary" onClick={handleZoomOut} style={{ marginRight: 0 }}>
          -
        </button>
        <button className="btn btn-secondary" onClick={handleFit}>
          Fit
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={handleExport}
          style={{ background: '#28a745' }}
          title="Export diagram as PNG"
        >
          📷 PNG
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={handleExportPDF}
          style={{ background: '#dc3545' }}
          title="Export diagram as PDF"
        >
          📄 PDF
        </button>
      </div>
      <div ref={containerRef} id="cy" style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default TreeViewer;

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

    // Fit to viewport
    cy.fit();

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

      const label = `${node.wallet_address.slice(0, 6)}...${node.wallet_address.slice(-4)}`;
      
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
      cyRef.current.fit();
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
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
        <button className="btn btn-secondary" onClick={handleZoomIn} style={{ marginRight: 5 }}>
          +
        </button>
        <button className="btn btn-secondary" onClick={handleZoomOut} style={{ marginRight: 5 }}>
          -
        </button>
        <button className="btn btn-secondary" onClick={handleFit}>
          Fit
        </button>
      </div>
      <div ref={containerRef} id="cy" style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default TreeViewer;

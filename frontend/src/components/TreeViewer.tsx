import React, { useEffect, useRef, useState } from 'react';
import { TreeStructure } from '../types/api';
import { apiService } from '../services/apiClient';

type ViewMode = '3x3' | 'direct';

interface TreeViewerProps {
  tree: TreeStructure | null;
  onNodeClick?: (nodeId: number) => void;
  maxDepth?: number;
  viewMode: ViewMode;
}

const TreeViewer: React.FC<TreeViewerProps> = ({ tree, onNodeClick, viewMode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [directSponsorTree, setDirectSponsorTree] = useState<TreeStructure | null>(null);
  const [isLoadingDirectTree, setIsLoadingDirectTree] = useState(false);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; content: string }>({
    visible: false,
    x: 0,
    y: 0,
    content: ''
  });

  // Fetch direct sponsor tree when viewMode is 'direct' and we have a root tree
  useEffect(() => {
    if (viewMode === 'direct' && tree) {
      setIsLoadingDirectTree(true);
      apiService.getDirectSponsorTree(tree.id)
        .then(directTree => {
          setDirectSponsorTree(directTree);
          setIsLoadingDirectTree(false);
        })
        .catch(error => {
          console.error('Error fetching direct sponsor tree:', error);
          setDebugInfo(prev => prev + `\n✗ Error loading direct sponsor tree: ${error}`);
          setIsLoadingDirectTree(false);
        });
    } else if (viewMode === '3x3') {
      // Clear direct sponsor tree when switching back to 3x3
      setDirectSponsorTree(null);
    }
  }, [viewMode, tree]);

  useEffect(() => {
    const currentTree = viewMode === 'direct' ? directSponsorTree : tree;
    setDebugInfo(`Tree received: ${currentTree ? 'Yes' : 'No'}`);
    
    if (currentTree) {
      const countNodes = (node: TreeStructure): number => {
        let count = 1; // Count this node
        if (node.children) {
          node.children.forEach(child => {
            count += countNodes(child);
          });
        }
        return count;
      };
      
      const totalNodes = countNodes(currentTree);
      setDebugInfo(prev => prev + `\nRoot ID: ${currentTree.id}`);
      setDebugInfo(prev => prev + `\nChildren count: ${currentTree.children?.length || 0}`);
      setDebugInfo(prev => prev + `\nTotal nodes in tree: ${totalNodes}`);
      setDebugInfo(prev => prev + `\nWallet: ${currentTree.wallet_address}`);
      setDebugInfo(prev => prev + `\nView Mode: ${viewMode}`);
    }
  }, [tree, directSponsorTree, viewMode]);

  const convertTreeToCytoscape = (tree: TreeStructure, mode: ViewMode): any[] => {
    const elements: any[] = [];
    const visited = new Set<number>();

    const addNode = (node: TreeStructure, parentId?: number, currentDepth: number = 0) => {
      if (visited.has(node.id)) return;
      
      // In "direct" mode, only show root (depth 0) and direct children (depth 1)
      // Note: The direct sponsor tree from API already only has one level, but we keep this check for safety
      if (mode === 'direct' && currentDepth > 1) {
        return;
      }
      
      visited.add(node.id);

      // Show only last 4 characters of wallet address
      const walletAddress = node.wallet_address || '';
      const label = walletAddress.length > 4 ? walletAddress.slice(-4) : walletAddress;
      
      elements.push({
        data: {
          id: `node-${node.id}`,
          label: label,
          wallet: node.wallet_address,
          position: node.position,
          depth: node.depth ?? currentDepth,
          parentId: parentId ?? null,
          activation_sequence: node.activation_sequence,
          total_nft_claimed: node.total_nft_claimed
        }
      });

      // Add children
      if (node.children) {
        node.children.forEach(child => {
          // In "direct" mode, only process children if we're at depth 0 (root)
          // The direct sponsor tree from API already only has one level, so this is mainly for 3x3 mode
          if (mode === 'direct' && currentDepth >= 1) {
            return;
          }
          
          // Recursively add child (will be filtered if depth > 1 in direct mode)
          addNode(child, node.id, currentDepth + 1);
          
          // Add edge from parent to child
          // In direct mode, we only add edges from root (depth 0) to direct children (depth 1)
          if (mode === '3x3' || (mode === 'direct' && currentDepth === 0)) {
            elements.push({
              data: {
                id: `edge-${node.id}-${child.id}`,
                source: `node-${node.id}`,
                target: `node-${child.id}`
              }
            });
          }
        });
      }
    };

    addNode(tree);
    return elements;
  };

  const initializeCytoscape = () => {
    // Use the appropriate tree based on view mode
    const currentTree = viewMode === 'direct' ? directSponsorTree : tree;
    
    if (!containerRef.current || !currentTree) {
      return;
    }

    try {
      // Check if Cytoscape is available
      if (typeof window !== 'undefined' && (window as any).cytoscape) {
        const cytoscape = (window as any).cytoscape;
        // For direct sponsor mode, always show full tree (it's already filtered to one level)
        const elements = convertTreeToCytoscape(currentTree, viewMode === 'direct' ? 'direct' : '3x3');

        // Determine maximum depth of the current tree
        const getMaxDepth = (node: TreeStructure): number => {
          if (!node.children || node.children.length === 0) return node.depth ?? 0;
          const currentDepth = node.depth ?? 0;
          let maxChild = currentDepth;
          node.children.forEach((c) => {
            const d = getMaxDepth(c);
            if (d > maxChild) maxChild = d;
          });
          return maxChild;
        };
        const maxTreeDepth = getMaxDepth(tree);

        // Clean up existing instance
        if (cyRef.current) {
          try {
            cyRef.current.destroy();
          } catch (e) {
            // Silently handle cleanup errors
          }
          cyRef.current = null;
        }

        // Clear the container
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        const cy = cytoscape({
          container: containerRef.current,
          elements: elements,
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
                'border-width': 3,
                'width': '70px',
                'height': '70px'
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
            roots: `#node-${currentTree.id}`,
            spacingFactor: 1.5,
            avoidOverlap: true,
            nodeDimensionsIncludeLabels: true,
            // Apply sibling order only for shallow trees (<= 2 levels)
            depthSort: maxTreeDepth <= 2 ? ((a: any, b: any) => {
              const parentA = a.data('parentId') ?? -1;
              const parentB = b.data('parentId') ?? -1;
              if (parentA !== parentB) return parentA - parentB;
              const posA = a.data('position') ?? 999;
              const posB = b.data('position') ?? 999;
              return posA - posB; // 1 (left), 2 (center), 3 (right)
            }) : undefined
          },
          userZoomingEnabled: true,
          userPanningEnabled: true,
          boxSelectionEnabled: false,
          selectionType: 'single'
        });

        cyRef.current = cy;

        // Add hover handlers for tooltip
        cy.on('mouseover', 'node', (event: any) => {
          const node = event.target;
          const nodeData = node.data();
          const nodeId = parseInt(node.id().replace('node-', ''));
          
          // Get node position for tooltip
          const pos = node.position();
          const containerRect = containerRef.current?.getBoundingClientRect();
          
          if (containerRect) {
            setTooltip({
              visible: true,
              x: containerRect.left + pos.x + 20,
              y: containerRect.top + pos.y - 20,
              content: `
                ID: ${nodeId}
                Wallet: ${nodeData.wallet || 'N/A'}
                Position: ${nodeData.position || 'N/A'}
                Depth: ${nodeData.depth || 'N/A'}
                Activation: ${nodeData.activation_sequence || 'N/A'}
                NFTs: ${nodeData.total_nft_claimed || 'N/A'}
              `.trim()
            });
          }
        });

        cy.on('mouseout', 'node', () => {
          setTooltip(prev => ({ ...prev, visible: false }));
        });

        // Add click handler for focus and expand
        cy.on('tap', 'node', (event: any) => {
          const node = event.target;
          const nodeId = parseInt(node.id().replace('node-', ''));
          
          // Set selected node
          setSelectedNode(nodeId);
          
          // Focus on the node
          cy.animate({
            center: { eles: node },
            zoom: Math.max(cy.zoom(), 1.5)
          }, {
            duration: 500
          });
          
          // Call parent click handler
          if (onNodeClick) {
            onNodeClick(nodeId);
          }
        });

        // Add double-click handler for expand/collapse
        cy.on('dbltap', 'node', (event: any) => {
          const node = event.target;
          
          // For now, just focus on the node
          cy.animate({
            center: { eles: node },
            zoom: 2
          }, {
            duration: 300
          });
        });

        // Wait a bit then fit to viewport with padding
        setTimeout(() => {
          cy.fit(undefined, 50); // 50px padding on all sides
          setDebugInfo(prev => prev + `\nCytoscape initialized successfully - ${elements.length} elements`);
        }, 100);
      } else {
        setDebugInfo(prev => prev + `\nCytoscape not available`);
      }
    } catch (error) {
      setDebugInfo(prev => prev + `\nError: ${error}`);
    }
  };

  useEffect(() => {
    const currentTree = viewMode === 'direct' ? directSponsorTree : tree;
    
    if (currentTree && !isLoadingDirectTree) {
      // Check if Cytoscape is already loaded
      if (typeof window !== 'undefined' && (window as any).cytoscape) {
        initializeCytoscape();
      } else {
        // Load Cytoscape dynamically
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/cytoscape@3.26.0/dist/cytoscape.min.js';
        script.onload = () => {
          initializeCytoscape();
        };
        script.onerror = () => {
          setDebugInfo(prev => prev + `\nFailed to load Cytoscape`);
        };
        document.head.appendChild(script);
      }
    }

    // Cleanup function
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [tree, directSponsorTree, viewMode, isLoadingDirectTree]);

  const currentTree = viewMode === 'direct' ? directSponsorTree : tree;

  if (!currentTree) {
    if (viewMode === 'direct' && isLoadingDirectTree) {
      return (
        <div className="tree-container">
          <div className="loading">Loading direct sponsor tree...</div>
          <pre style={{ fontSize: '12px', background: '#f5f5f5', padding: '10px' }}>
            {debugInfo}
          </pre>
        </div>
      );
    }
    return (
      <div className="tree-container">
        <div className="loading">No tree data available</div>
        <pre style={{ fontSize: '12px', background: '#f5f5f5', padding: '10px' }}>
          {debugInfo}
        </pre>
      </div>
    );
  }

  return (
    <div className="tree-container" style={{ position: 'relative', width: '100%', height: '100%', minHeight: '400px' }}>
      {/* Debug Panel */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, background: 'white', padding: '10px', border: '1px solid #ccc', maxWidth: '300px' }}>
        <pre style={{ fontSize: '10px', margin: 0, whiteSpace: 'pre-wrap' }}>
          {debugInfo}
        </pre>
      </div>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            background: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            zIndex: 10000,
            pointerEvents: 'none',
            whiteSpace: 'pre-line',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            maxWidth: '250px'
          }}
        >
          {tooltip.content}
        </div>
      )}

      {/* Selected Node Info */}
      {selectedNode && (
        <div style={{ 
          position: 'absolute', 
          bottom: 10, 
          left: 10, 
          background: 'rgba(0, 123, 255, 0.9)', 
          color: 'white', 
          padding: '8px 12px', 
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000
        }}>
          Selected Node: {selectedNode}
        </div>
      )}

      {/* Control Buttons */}
      <div style={{ 
        position: 'absolute', 
        top: 10, 
        left: 10, 
        zIndex: 1000,
        display: 'flex',
        gap: '5px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => {
            if (cyRef.current) {
              cyRef.current.fit(undefined, 50); // Fit with 50px padding
            }
          }}
          style={{
            padding: '5px 10px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Fit All
        </button>
        <button
          onClick={async () => {
            if (cyRef.current) {
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
                  scale: 2 // Higher resolution
                });
                
                // Create download link
                const link = document.createElement('a');
                link.download = `tree-diagram-${new Date().toISOString().slice(0, 10)}.png`;
                link.href = 'data:image/png;base64,' + png64;
                link.click();
                
                setDebugInfo(prev => prev + `\n✓ Exported tree diagram as PNG`);
              } catch (error) {
                setDebugInfo(prev => prev + `\n✗ Export failed: ${error}`);
                
                // Fallback: try html2canvas if available
                if ((window as any).html2canvas) {
                  try {
                    const canvas = await (window as any).html2canvas(containerRef.current, {
                      backgroundColor: '#ffffff',
                      scale: 2,
                      logging: false
                    });
                    canvas.toBlob((blob: Blob) => {
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.download = `tree-diagram-${new Date().toISOString().slice(0, 10)}.png`;
                      link.href = url;
                      link.click();
                      URL.revokeObjectURL(url);
                    });
                  } catch (fallbackError) {
                    // Silently handle fallback errors
                  }
                }
              }
            }
          }}
          style={{
            padding: '5px 10px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          📷 PNG
        </button>
        <button
          onClick={async () => {
            if (cyRef.current) {
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
                  orientation: 'landscape',
                  unit: 'px',
                  format: [1920, 1080]
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
                      setDebugInfo(prev => prev + `\n✓ Exported tree diagram as PDF`);
                      resolve();
                    } catch (error) {
                      reject(error);
                    }
                  };
                  img.onerror = reject;
                });
              } catch (error) {
                setDebugInfo(prev => prev + `\n✗ PDF export failed: ${error}`);
                alert('PDF export failed. Try using browser Print (Ctrl+P) and Save as PDF option.');
              }
            }
          }}
          style={{
            padding: '5px 10px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          📄 PDF
        </button>
        <button
          onClick={() => {
            if (cyRef.current) {
              cyRef.current.zoom(cyRef.current.zoom() * 1.2);
            }
          }}
          style={{
            padding: '5px 10px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Zoom In
        </button>
        <button
          onClick={() => {
            if (cyRef.current) {
              cyRef.current.zoom(cyRef.current.zoom() * 0.8);
            }
          }}
          style={{
            padding: '5px 10px',
            background: '#ffc107',
            color: 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Zoom Out
        </button>
      </div>

      {/* Cytoscape Container */}
      <div 
        ref={containerRef} 
        id="cy" 
        style={{ 
          width: '100%', 
          height: '100%', 
          minHeight: '400px',
          border: '1px solid #ddd',
          background: '#fafafa'
        }} 
      />
    </div>
  );
};

export default TreeViewer;

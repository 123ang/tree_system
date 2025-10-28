/**
 * Direct Sales Tree Diagram Widget
 * Embed this script on your website to display interactive tree diagrams
 */

(function() {
  'use strict';

  // Configuration
  const DEFAULT_CONFIG = {
    apiUrl: 'https://yourdomain.com/api', // Update this to your deployed API URL
    container: 'tree-container',
    memberId: null,
    wallet: null,
    maxDepth: 3,
    width: '100%',
    height: '600px',
    showControls: true,
    showTooltips: true,
    nodeStyle: {
      backgroundColor: '#007bff',
      textColor: 'white',
      borderColor: '#0056b3',
      fontSize: '10px',
      width: '60px',
      height: '60px'
    },
    edgeStyle: {
      color: '#ccc',
      width: 2,
      arrowColor: '#ccc'
    },
    onNodeClick: null,
    onError: null
  };

  // Global widget instance
  window.TreeWidget = {
    instances: new Map(),
    
    // Initialize a new tree widget
    init: function(config) {
      const finalConfig = { ...DEFAULT_CONFIG, ...config };
      const container = document.getElementById(finalConfig.container);
      
      if (!container) {
        console.error('TreeWidget: Container element not found:', finalConfig.container);
        return null;
      }

      const instance = new TreeWidgetInstance(finalConfig, container);
      this.instances.set(finalConfig.container, instance);
      return instance;
    },

    // Destroy a widget instance
    destroy: function(containerId) {
      const instance = this.instances.get(containerId);
      if (instance) {
        instance.destroy();
        this.instances.delete(containerId);
      }
    },

    // Get widget instance
    getInstance: function(containerId) {
      return this.instances.get(containerId);
    }
  };

  // Tree Widget Instance Class
  class TreeWidgetInstance {
    constructor(config, container) {
      this.config = config;
      this.container = container;
      this.cy = null;
      this.tooltip = null;
      this.isLoading = false;
      
      this.init();
    }

    async init() {
      try {
        this.showLoading();
        await this.loadCytoscape();
        await this.loadTreeData();
        this.renderTree();
        this.hideLoading();
      } catch (error) {
        this.showError('Failed to initialize tree widget: ' + error.message);
        if (this.config.onError) {
          this.config.onError(error);
        }
      }
    }

    async loadCytoscape() {
      return new Promise((resolve, reject) => {
        if (window.cytoscape) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/cytoscape@3.26.0/dist/cytoscape.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Cytoscape.js'));
        document.head.appendChild(script);
      });
    }

    async loadTreeData() {
      let url;
      if (this.config.memberId) {
        url = `${this.config.apiUrl}/tree/${this.config.memberId}?maxDepth=${this.config.maxDepth}`;
      } else if (this.config.wallet) {
        url = `${this.config.apiUrl}/tree/wallet/${this.config.wallet}?maxDepth=${this.config.maxDepth}`;
      } else {
        throw new Error('Either memberId or wallet must be provided');
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      this.treeData = await response.json();
    }

    renderTree() {
      if (!this.treeData) return;

      // Clear container
      this.container.innerHTML = '';

      // Create tooltip element
      this.tooltip = document.createElement('div');
      this.tooltip.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        pointer-events: none;
        display: none;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        max-width: 250px;
        font-family: monospace;
      `;
      document.body.appendChild(this.tooltip);

      // Create cytoscape container
      const cyContainer = document.createElement('div');
      cyContainer.style.cssText = `
        width: 100%;
        height: 100%;
        border: 1px solid #ddd;
        background: #fafafa;
      `;
      this.container.appendChild(cyContainer);

      // Convert tree to cytoscape elements
      const elements = this.convertTreeToCytoscape(this.treeData);

      // Initialize cytoscape
      this.cy = cytoscape({
        container: cyContainer,
        elements: elements,
        style: this.getCytoscapeStyles(),
        layout: {
          name: 'breadthfirst',
          directed: true,
          roots: `#node-${this.treeData.id}`,
          spacingFactor: 1.5,
          avoidOverlap: true,
          nodeDimensionsIncludeLabels: true
        },
        userZoomingEnabled: true,
        userPanningEnabled: true,
        boxSelectionEnabled: false,
        selectionType: 'single'
      });

      // Add event handlers
      this.setupEventHandlers();

      // Add controls if enabled
      if (this.config.showControls) {
        this.addControls();
      }

      // Fit to viewport
      this.cy.fit();
    }

    convertTreeToCytoscape(tree) {
      const elements = [];
      const visited = new Set();

      const addNode = (node) => {
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
            total_nft_claimed: node.total_nft_claimed,
            originalData: node
          }
        });

        if (node.children && node.children.length > 0) {
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
        }
      };

      addNode(tree);
      return elements;
    }

    getCytoscapeStyles() {
      return [
        {
          selector: 'node',
          style: {
            'background-color': this.config.nodeStyle.backgroundColor,
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': this.config.nodeStyle.textColor,
            'font-size': this.config.nodeStyle.fontSize,
            'width': this.config.nodeStyle.width,
            'height': this.config.nodeStyle.height,
            'border-width': 2,
            'border-color': this.config.nodeStyle.borderColor,
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
            'width': this.config.edgeStyle.width,
            'line-color': this.config.edgeStyle.color,
            'target-arrow-color': this.config.edgeStyle.arrowColor,
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
      ];
    }

    setupEventHandlers() {
      // Node click handler
      this.cy.on('tap', 'node', (event) => {
        const node = event.target;
        const nodeId = parseInt(node.id().replace('node-', ''));
        const nodeData = node.data('originalData');
        
        if (this.config.onNodeClick) {
          this.config.onNodeClick(nodeId, nodeData);
        }
      });

      // Tooltip handlers
      if (this.config.showTooltips) {
        this.cy.on('mouseover', 'node', (event) => {
          const node = event.target;
          const nodeData = node.data();
          const pos = event.cyRenderedPosition;
          const containerRect = this.container.getBoundingClientRect();
          
          this.tooltip.style.left = `${containerRect.left + pos.x + 20}px`;
          this.tooltip.style.top = `${containerRect.top + pos.y - 20}px`;
          this.tooltip.style.display = 'block';
          this.tooltip.innerHTML = `
            <div><strong>ID:</strong> ${nodeData.id}</div>
            <div><strong>Wallet:</strong> ${nodeData.wallet}</div>
            <div><strong>Position:</strong> ${nodeData.position || 'N/A'}</div>
            <div><strong>Depth:</strong> ${nodeData.depth || 'N/A'}</div>
            <div><strong>Activation:</strong> ${nodeData.activation_sequence || 'N/A'}</div>
            <div><strong>NFTs:</strong> ${nodeData.total_nft_claimed || 'N/A'}</div>
          `;
        });

        this.cy.on('mouseout', 'node', () => {
          this.tooltip.style.display = 'none';
        });
      }
    }

    addControls() {
      const controls = document.createElement('div');
      controls.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 1000;
        display: flex;
        gap: 5px;
      `;

      const buttons = [
        { text: 'Fit', action: () => this.cy.fit() },
        { text: '+', action: () => this.cy.zoom(this.cy.zoom() * 1.2) },
        { text: '-', action: () => this.cy.zoom(this.cy.zoom() * 0.8) }
      ];

      buttons.forEach(btn => {
        const button = document.createElement('button');
        button.textContent = btn.text;
        button.style.cssText = `
          padding: 5px 10px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        `;
        button.onclick = btn.action;
        controls.appendChild(button);
      });

      this.container.appendChild(controls);
    }

    showLoading() {
      this.container.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          background: #fafafa;
          border: 1px solid #ddd;
        ">
          <div style="text-align: center;">
            <div style="font-size: 16px; margin-bottom: 10px;">Loading tree diagram...</div>
            <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
          </div>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
    }

    hideLoading() {
      // Loading will be replaced by the tree
    }

    showError(message) {
      this.container.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          background: #fafafa;
          border: 1px solid #ddd;
          color: #dc3545;
          text-align: center;
          padding: 20px;
        ">
          <div>
            <div style="font-size: 16px; margin-bottom: 10px;">⚠️ Error</div>
            <div style="font-size: 14px;">${message}</div>
          </div>
        </div>
      `;
    }

    // Public methods
    fit() {
      if (this.cy) this.cy.fit();
    }

    zoomIn() {
      if (this.cy) this.cy.zoom(this.cy.zoom() * 1.2);
    }

    zoomOut() {
      if (this.cy) this.cy.zoom(this.cy.zoom() * 0.8);
    }

    centerOnNode(nodeId) {
      if (this.cy) {
        const node = this.cy.getElementById(`node-${nodeId}`);
        if (node.length > 0) {
          this.cy.animate({
            center: { eles: node },
            zoom: Math.max(this.cy.zoom(), 1.5)
          }, { duration: 500 });
        }
      }
    }

    destroy() {
      if (this.cy) {
        this.cy.destroy();
        this.cy = null;
      }
      if (this.tooltip) {
        this.tooltip.remove();
        this.tooltip = null;
      }
    }
  }

})();

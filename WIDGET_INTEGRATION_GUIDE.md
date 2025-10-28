# Tree Diagram Widget Integration Guide

This guide shows other websites how to embed the Direct Sales Tree Diagram into their own websites.

## 🌐 Live Demo

- **Embed Page**: `https://yourdomain.com/embed.html`
- **Widget Script**: `https://yourdomain.com/widget.js`
- **API Endpoints**: `https://yourdomain.com/api/*`

## 📋 Integration Methods

### Method 1: JavaScript Widget (Recommended)

#### Step 1: Include the Widget Script

```html
<!-- Include the widget script -->
<script src="https://yourdomain.com/widget.js"></script>
```

#### Step 2: Create a Container

```html
<!-- Create a container for the tree diagram -->
<div id="tree-container" style="width: 100%; height: 600px;"></div>
```

#### Step 3: Initialize the Widget

```javascript
// Initialize the tree widget
const treeWidget = TreeWidget.init({
  container: 'tree-container',
  apiUrl: 'https://yourdomain.com/api',
  memberId: 123, // or use wallet: '0x1234...'
  maxDepth: 3,
  showControls: true,
  showTooltips: true,
  onNodeClick: (nodeId, nodeData) => {
    console.log('Node clicked:', nodeId, nodeData);
    // Handle node click events
  },
  onError: (error) => {
    console.error('Tree widget error:', error);
    // Handle errors
  }
});
```

#### Complete Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Website with Tree Diagram</title>
    <script src="https://yourdomain.com/widget.js"></script>
</head>
<body>
    <h1>Direct Sales Tree</h1>
    <div id="tree-container" style="width: 100%; height: 600px; border: 1px solid #ddd;"></div>
    
    <script>
        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', function() {
            const treeWidget = TreeWidget.init({
                container: 'tree-container',
                apiUrl: 'https://yourdomain.com/api',
                memberId: 123,
                maxDepth: 3,
                showControls: true,
                showTooltips: true,
                onNodeClick: (nodeId, nodeData) => {
                    alert(`Clicked node ${nodeId}: ${nodeData.wallet_address}`);
                }
            });
        });
    </script>
</body>
</html>
```

### Method 2: Iframe Embedding

#### Simple Iframe

```html
<iframe 
  src="https://yourdomain.com/embed.html?memberId=123&maxDepth=3" 
  width="100%" 
  height="600px"
  frameborder="0">
</iframe>
```

#### Iframe with Search

```html
<iframe 
  src="https://yourdomain.com/embed.html?wallet=0x1234567890abcdef" 
  width="100%" 
  height="600px"
  frameborder="0">
</iframe>
```

### Method 3: API Integration

#### Fetch Tree Data

```javascript
// Fetch tree data from API
async function loadTreeData(memberId) {
  try {
    const response = await fetch(`https://yourdomain.com/api/tree/${memberId}?maxDepth=3`);
    const treeData = await response.json();
    
    // Use your own visualization library
    renderTreeWithYourLibrary(treeData);
  } catch (error) {
    console.error('Error loading tree data:', error);
  }
}
```

#### Search Members

```javascript
// Search for member by wallet address
async function searchMember(walletAddress) {
  try {
    const response = await fetch(`https://yourdomain.com/api/members/wallet/${walletAddress}`);
    const member = await response.json();
    
    if (member && member.id) {
      // Load tree for this member
      loadTreeData(member.id);
    }
  } catch (error) {
    console.error('Error searching member:', error);
  }
}
```

## ⚙️ Configuration Options

### Widget Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `container` | string | - | ID of the container element (required) |
| `apiUrl` | string | - | Your API base URL (required) |
| `memberId` | number | null | Member ID to display (or use wallet) |
| `wallet` | string | null | Wallet address to search (or use memberId) |
| `maxDepth` | number | 3 | Maximum tree depth to display |
| `width` | string | '100%' | Container width |
| `height` | string | '600px' | Container height |
| `showControls` | boolean | true | Show zoom/pan controls |
| `showTooltips` | boolean | true | Show tooltips on hover |
| `onNodeClick` | function | null | Node click callback |
| `onError` | function | null | Error callback |

### Node Styling

```javascript
const treeWidget = TreeWidget.init({
  // ... other options
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
  }
});
```

## 🎮 Widget Methods

### Control Methods

```javascript
const treeWidget = TreeWidget.init({...});

// Fit tree to viewport
treeWidget.fit();

// Zoom in/out
treeWidget.zoomIn();
treeWidget.zoomOut();

// Center on specific node
treeWidget.centerOnNode(123);

// Destroy widget
treeWidget.destroy();
```

### Multiple Widgets

```javascript
// Create multiple tree widgets on the same page
const widget1 = TreeWidget.init({
  container: 'tree-container-1',
  memberId: 123
});

const widget2 = TreeWidget.init({
  container: 'tree-container-2',
  memberId: 456
});
```

## 🔧 API Endpoints

### Tree Endpoints

- `GET /api/tree/:id?maxDepth=3` - Get tree by member ID
- `GET /api/tree/wallet/:wallet?maxDepth=3` - Get tree by wallet address
- `GET /api/search?term=searchTerm` - Search members
- `GET /api/stats/:id` - Get subtree statistics
- `GET /api/level/:id/:level?limit=100&offset=0` - Get members by level

### Member Endpoints

- `GET /api/members` - Get all members
- `GET /api/members/:id` - Get member by ID
- `GET /api/members/wallet/:wallet` - Get member by wallet address
- `GET /api/members/:id/layer` - Get member layer information

## 🎨 Styling Examples

### Custom Container Styling

```css
#tree-container {
  border: 2px solid #007bff;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  background: #fafafa;
}

#tree-container .cy {
  border-radius: 6px;
}
```

### Responsive Design

```css
#tree-container {
  width: 100%;
  height: 60vh; /* Responsive height */
  min-height: 400px;
  max-height: 800px;
}

@media (max-width: 768px) {
  #tree-container {
    height: 50vh;
    min-height: 300px;
  }
}
```

## 🚀 React Integration

### React Component

```jsx
import React, { useEffect, useRef } from 'react';

const TreeDiagram = ({ memberId, maxDepth = 3 }) => {
  const containerRef = useRef(null);
  const widgetRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      widgetRef.current = TreeWidget.init({
        container: containerRef.current.id,
        apiUrl: 'https://yourdomain.com/api',
        memberId,
        maxDepth,
        onNodeClick: (nodeId, nodeData) => {
          console.log('Node clicked:', nodeId, nodeData);
        }
      });
    }

    return () => {
      if (widgetRef.current) {
        widgetRef.current.destroy();
      }
    };
  }, [memberId, maxDepth]);

  return (
    <div 
      id="tree-container" 
      ref={containerRef}
      style={{ width: '100%', height: '600px' }}
    />
  );
};

export default TreeDiagram;
```

### Usage in React App

```jsx
import TreeDiagram from './TreeDiagram';

function App() {
  return (
    <div>
      <h1>My App</h1>
      <TreeDiagram memberId={123} maxDepth={3} />
    </div>
  );
}
```

## 🔒 Security Considerations

### CORS Configuration

The API is configured to allow cross-origin requests. For production:

1. **Update CORS origins** in `src/server.ts`:
   ```javascript
   origin: [
     'https://yourdomain.com',
     'https://trusted-website.com',
     // Add specific domains only
   ]
   ```

2. **Rate limiting** - Consider adding rate limiting for API endpoints
3. **Authentication** - Add API keys if needed for sensitive data

### Content Security Policy

If using iframe embedding, ensure your CSP allows the iframe:

```html
<meta http-equiv="Content-Security-Policy" content="frame-src https://yourdomain.com;">
```

## 📱 Mobile Support

The widget is fully responsive and works on mobile devices:

- Touch gestures for zoom/pan
- Responsive container sizing
- Mobile-optimized controls

## 🐛 Troubleshooting

### Common Issues

1. **Widget not loading**
   - Check if `widget.js` is accessible
   - Verify API URL is correct
   - Check browser console for errors

2. **CORS errors**
   - Ensure your domain is in the CORS whitelist
   - Check if API is accessible from your domain

3. **Tree not displaying**
   - Verify memberId or wallet is valid
   - Check if API returns data
   - Ensure container element exists

### Debug Mode

Enable debug logging:

```javascript
const treeWidget = TreeWidget.init({
  // ... other options
  onError: (error) => {
    console.error('Tree Widget Error:', error);
    // Show error to user
  }
});
```

## 📞 Support

For integration support:

- **Documentation**: This guide
- **API Reference**: Check `/api/health` endpoint
- **Examples**: See `embed.html` for reference implementation

## 🔄 Updates

To get updates:

1. **Check API version**: `GET /api/health`
2. **Widget version**: Check `widget.js` comments
3. **Breaking changes**: Will be documented here

---

**Ready to integrate?** Start with the [JavaScript Widget](#method-1-javascript-widget-recommended) method for the easiest integration!

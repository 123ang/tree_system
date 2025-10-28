# Member Management System

This document describes the comprehensive CRUD (Create, Read, Update, Delete) interface for managing members in the Direct Sales Tree system.

## Features

### 🔧 Core CRUD Operations
- **Create**: Add new members with automatic tree placement
- **Read**: View member details, list all members, search functionality
- **Update**: Modify member information and tree relationships
- **Delete**: Remove members (with safety checks for children)

### 📊 Layer & Sponsor Tracking
- **Layer Calculation**: Automatically calculates which layer a member is on from the root
- **Sponsor Chain**: Shows the complete sponsor hierarchy up to the root
- **Root Distance**: Displays how many levels away from the root
- **Tree Position**: Shows position (1, 2, or 3) within parent's children

### 🎯 Key Capabilities

#### Member Information
- **Wallet Address**: Unique Ethereum wallet identifier (required)
- **Username**: Optional display name
- **Sponsor ID**: Reference to the member who referred this member
- **Activation Sequence**: Order of activation from CSV import
- **Current Level**: Level from CSV (for reference)
- **Total NFTs Claimed**: Number of NFTs claimed by this member

#### Tree Management
- **Automatic Placement**: New members are automatically placed in the tree structure
- **Position Management**: Each parent can have up to 3 children (positions 1, 2, 3)
- **Closure Table**: Efficient queries for ancestor/descendant relationships
- **Layer Tracking**: Real-time calculation of member depth from root

## API Endpoints

### Member CRUD Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/members` | Get all members (with pagination) |
| `GET` | `/api/members/:id` | Get member by ID |
| `GET` | `/api/members/wallet/:wallet` | Get member by wallet address |
| `GET` | `/api/members/:id/layer` | Get member layer information |
| `POST` | `/api/members` | Create new member |
| `PUT` | `/api/members/:id` | Update member |
| `DELETE` | `/api/members/:id` | Delete member |

### Request/Response Examples

#### Create Member
```bash
POST /api/members
Content-Type: application/json

{
  "wallet_address": "0x1234567890123456789012345678901234567890",
  "username": "JohnDoe",
  "sponsor_id": 5,
  "activation_sequence": 10,
  "current_level": 2,
  "total_nft_claimed": 3
}
```

#### Update Member
```bash
PUT /api/members/123
Content-Type: application/json

{
  "username": "JohnDoeUpdated",
  "current_level": 3,
  "total_nft_claimed": 5
}
```

#### Get Layer Information
```bash
GET /api/members/123/layer
```

Response:
```json
{
  "layer": 2,
  "sponsorChain": [
    {
      "id": 1,
      "wallet_address": "0xroot...",
      "username": "RootUser"
    },
    {
      "id": 5,
      "wallet_address": "0xsponsor...",
      "username": "SponsorUser"
    },
    {
      "id": 123,
      "wallet_address": "0xmember...",
      "username": "JohnDoe"
    }
  ],
  "rootDistance": 2,
  "isRoot": false
}
```

## Frontend Interface

### Member Management Tab
The interface includes a dedicated "Member Management" tab with:

#### Member List
- **Grid View**: Shows wallet address, username, layer, children count
- **Search**: Real-time search by wallet address or username
- **Pagination**: Navigate through large member lists
- **Selection**: Click to view detailed member information

#### Member Details Panel
- **Basic Info**: ID, wallet, username, join date
- **Tree Info**: Sponsor ID, position, children count
- **Layer Info**: Current layer, root distance, sponsor chain
- **Business Data**: Activation sequence, level, NFTs claimed

#### CRUD Operations
- **Add Member**: Modal form for creating new members
- **Edit Member**: In-place editing of member information
- **Delete Member**: Safe deletion with confirmation
- **Validation**: Real-time validation of wallet addresses and sponsor IDs

### Form Validation
- **Wallet Address**: Must be valid Ethereum address format (0x + 40 hex chars)
- **Sponsor ID**: Must reference existing member
- **Unique Constraints**: Wallet addresses must be unique
- **Tree Rules**: Parents can have maximum 3 children

## Database Schema

### Members Table
```sql
CREATE TABLE members (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  wallet_address VARCHAR(42) NOT NULL UNIQUE,
  username VARCHAR(80) NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  root_id BIGINT NULL,
  sponsor_id BIGINT NULL,
  activation_sequence INT NULL,
  current_level INT NULL,
  total_nft_claimed INT NULL,
  CONSTRAINT fk_members_sponsor FOREIGN KEY (sponsor_id) REFERENCES members(id),
  CONSTRAINT fk_members_root FOREIGN KEY (root_id) REFERENCES members(id)
);
```

### Placements Table
```sql
CREATE TABLE placements (
  parent_id BIGINT NOT NULL,
  child_id BIGINT NOT NULL,
  position TINYINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (child_id),
  CONSTRAINT fk_pl_parent FOREIGN KEY (parent_id) REFERENCES members(id),
  CONSTRAINT fk_pl_child FOREIGN KEY (child_id) REFERENCES members(id),
  CONSTRAINT uq_parent_pos UNIQUE (parent_id, position),
  CONSTRAINT chk_pos CHECK (position BETWEEN 1 AND 3)
);
```

### Closure Table
```sql
CREATE TABLE member_closure (
  ancestor_id BIGINT NOT NULL,
  descendant_id BIGINT NOT NULL,
  depth INT NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id),
  CONSTRAINT fk_mc_anc FOREIGN KEY (ancestor_id) REFERENCES members(id),
  CONSTRAINT fk_mc_des FOREIGN KEY (descendant_id) REFERENCES members(id)
);
```

## Usage Examples

### 1. Adding a Root Member
```javascript
const rootMember = await apiService.createMember({
  wallet_address: '0xRootAddress...',
  username: 'RootUser'
  // No sponsor_id = becomes root
});
```

### 2. Adding a Sponsored Member
```javascript
const sponsoredMember = await apiService.createMember({
  wallet_address: '0xNewMember...',
  username: 'NewUser',
  sponsor_id: rootMember.id
});
```

### 3. Checking Member Layer
```javascript
const layerInfo = await apiService.getMemberLayerInfo(memberId);
console.log(`Member is on layer ${layerInfo.layer} from root`);
console.log(`Sponsor chain: ${layerInfo.sponsorChain.length} levels`);
```

### 4. Updating Member Information
```javascript
const updatedMember = await apiService.updateMember(memberId, {
  username: 'UpdatedUsername',
  current_level: 5,
  total_nft_claimed: 10
});
```

## Error Handling

### Common Error Scenarios
- **Duplicate Wallet**: `409 Conflict` - Wallet address already exists
- **Invalid Sponsor**: `400 Bad Request` - Sponsor ID not found
- **Tree Full**: `400 Bad Request` - Parent already has 3 children
- **Member Not Found**: `404 Not Found` - Member ID doesn't exist
- **Has Children**: `400 Bad Request` - Cannot delete member with children

### Validation Rules
- Wallet addresses must be valid Ethereum format
- Sponsor must exist before creating sponsored member
- Parents limited to 3 children maximum
- Cannot delete members who have children
- All operations are transactional (all-or-nothing)

## Testing

Run the test script to verify CRUD functionality:
```bash
node test-member-crud.js
```

This will test:
1. Creating members
2. Reading member data
3. Updating member information
4. Layer calculation
5. Sponsor relationships
6. Deleting members

## Integration

The member management system integrates seamlessly with:
- **Tree Visualization**: Members appear in the tree view
- **Search Functionality**: Search by wallet or username
- **Statistics**: Real-time member counts and layer distributions
- **Caching**: Automatic cache invalidation on member updates

## Performance Considerations

- **Closure Table**: Enables efficient ancestor/descendant queries
- **Indexes**: Optimized for wallet lookups and tree traversals
- **Pagination**: Large member lists are paginated
- **Caching**: Frontend caches tree data for performance
- **Transactions**: All operations are atomic

This system provides a complete solution for managing the direct sales tree structure with full CRUD capabilities and comprehensive layer tracking.


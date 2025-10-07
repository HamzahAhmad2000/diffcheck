import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Card,
  CardContent,
  CardActions,
  CardMedia,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Add as AddIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Image as ImageIcon,
  FilterList as FilterIcon,
  Sort as SortIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';

const ItemManagement = ({
  type = 'feature', // 'feature' or 'bug'
  items = [],
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onVoteItem,
  onUpdateStatus,
  onBulkUpdateStatus,
  loading = false,
  error = null,
  userVotes = {}, // Map of item_id to vote value (1 or -1)
  isAdmin = false
}) => {
  // State
  const [newItem, setNewItem] = useState({ title: '', description: '', image: null });
  const [editingItem, setEditingItem] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedItems, setSelectedItems] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [imagePreview, setImagePreview] = useState(null);

  // Image upload
  const { getRootProps, getInputProps } = useDropzone({
    accept: 'image/*',
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      setNewItem({ ...newItem, image: file });
      setImagePreview(URL.createObjectURL(file));
    }
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!showCreateDialog) {
      setNewItem({ title: '', description: '', image: null });
      setImagePreview(null);
    }
  }, [showCreateDialog]);

  // Filter and sort items
  const filteredItems = items.filter(item => {
    if (statusFilter === 'all') return true;
    return item.status === statusFilter;
  }).sort((a, b) => {
    if (sortBy === 'votes') {
      return b.net_votes - a.net_votes;
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  // Handlers
  const handleCreate = () => {
    onCreateItem(newItem);
    setShowCreateDialog(false);
  };

  const handleEdit = () => {
    onUpdateItem(editingItem.id, editingItem);
    setShowEditDialog(false);
  };

  const handleVote = (itemId, voteType) => {
    onVoteItem(itemId, voteType);
  };

  const handleStatusChange = (itemId, newStatus) => {
    onUpdateStatus(itemId, newStatus);
  };

  const handleBulkStatusUpdate = () => {
    if (bulkStatus && selectedItems.length > 0) {
      onBulkUpdateStatus(selectedItems, bulkStatus);
      setSelectedItems([]);
      setBulkStatus('');
    }
  };

  const handleItemSelect = (itemId) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      }
      return [...prev, itemId];
    });
  };

  // Status chip color mapping
  const statusColors = {
    'PENDING': 'default',
    'COMPLETED': 'success',
    'REJECTED': 'error',
    'UNDER_REVIEW': 'warning',
    'PLANNED': 'info'
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters and Actions */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Status Filter</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status Filter"
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="PENDING">Pending</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
                <MenuItem value="REJECTED">Rejected</MenuItem>
                <MenuItem value="UNDER_REVIEW">Under Review</MenuItem>
                <MenuItem value="PLANNED">Planned</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                label="Sort By"
              >
                <MenuItem value="newest">Newest</MenuItem>
                <MenuItem value="votes">Most Voted</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowCreateDialog(true)}
              fullWidth
            >
              {`New ${type === 'feature' ? 'Feature Request' : 'Bug Report'}`}
            </Button>
          </Grid>
        </Grid>

        {/* Bulk Actions (Admin Only) */}
        {isAdmin && selectedItems.length > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs>
                <Typography variant="subtitle1">
                  {selectedItems.length} items selected
                </Typography>
              </Grid>
              <Grid item>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Bulk Status Update</InputLabel>
                  <Select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    label="Bulk Status Update"
                  >
                    <MenuItem value="COMPLETED">Mark as Completed</MenuItem>
                    <MenuItem value="REJECTED">Mark as Rejected</MenuItem>
                    <MenuItem value="UNDER_REVIEW">Mark as Under Review</MenuItem>
                    <MenuItem value="PLANNED">Mark as Planned</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item>
                <Button
                  variant="contained"
                  onClick={handleBulkStatusUpdate}
                  disabled={!bulkStatus}
                >
                  Update Status
                </Button>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>

      {/* Items Grid */}
      <Grid container spacing={2}>
        {filteredItems.map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item.id}>
            <Card>
              {item.image_url && (
                <CardMedia
                  component="img"
                  height="140"
                  image={item.image_url}
                  alt={item.title}
                />
              )}
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    {item.title}
                  </Typography>
                  {isAdmin && (
                    <Checkbox
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleItemSelect(item.id)}
                    />
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {item.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Chip
                    label={item.status}
                    color={statusColors[item.status]}
                    size="small"
                  />
                  <Typography variant="caption" color="text.secondary">
                    by {item.user_name}
                  </Typography>
                </Box>
              </CardContent>
              <CardActions>
                <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                  <Box>
                    <Tooltip title="Upvote">
                      <IconButton
                        onClick={() => handleVote(item.id, 1)}
                        color={userVotes[item.id] === 1 ? 'primary' : 'default'}
                      >
                        <Badge badgeContent={item.upvotes} color="primary">
                          <ThumbUpIcon />
                        </Badge>
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Downvote">
                      <IconButton
                        onClick={() => handleVote(item.id, -1)}
                        color={userVotes[item.id] === -1 ? 'error' : 'default'}
                      >
                        <Badge badgeContent={item.downvotes} color="error">
                          <ThumbDownIcon />
                        </Badge>
                      </IconButton>
                    </Tooltip>
                  </Box>
                  {isAdmin && (
                    <Box>
                      <IconButton
                        onClick={() => {
                          setEditingItem(item);
                          setShowEditDialog(true);
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => onDeleteItem(item.id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  )}
                </Box>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {`New ${type === 'feature' ? 'Feature Request' : 'Bug Report'}`}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              label="Title"
              fullWidth
              value={newItem.title}
              onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={4}
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              sx={{ mb: 2 }}
            />
            <Paper
              {...getRootProps()}
              sx={{
                p: 2,
                border: '2px dashed',
                borderColor: 'divider',
                textAlign: 'center',
                cursor: 'pointer',
                mb: 2
              }}
            >
              <input {...getInputProps()} />
              {imagePreview ? (
                <Box>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{ maxWidth: '100%', maxHeight: 200 }}
                  />
                  <Typography variant="caption" display="block">
                    Click or drag to replace image
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <ImageIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                  <Typography>
                    Drag and drop an image here, or click to select
                  </Typography>
                </Box>
              )}
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!newItem.title || loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {`Edit ${type === 'feature' ? 'Feature Request' : 'Bug Report'}`}
        </DialogTitle>
        <DialogContent>
          {editingItem && (
            <Box sx={{ mt: 2 }}>
              <TextField
                label="Title"
                fullWidth
                value={editingItem.title}
                onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                sx={{ mb: 2 }}
              />
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={4}
                value={editingItem.description}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                sx={{ mb: 2 }}
              />
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={editingItem.status}
                  onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value })}
                  label="Status"
                >
                  <MenuItem value="PENDING">Pending</MenuItem>
                  <MenuItem value="COMPLETED">Completed</MenuItem>
                  <MenuItem value="REJECTED">Rejected</MenuItem>
                  <MenuItem value="UNDER_REVIEW">Under Review</MenuItem>
                  <MenuItem value="PLANNED">Planned</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleEdit}
            disabled={!editingItem?.title || loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItemManagement; 
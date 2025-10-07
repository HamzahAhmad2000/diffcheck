import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Share as ShareIcon,
  Analytics as AnalyticsIcon
} from '@mui/icons-material';
import AudienceSelection from '../common/AudienceSelection';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

const BusinessSurveys = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin' || (user?.role === 'business_admin' && user?.business_id === businessId);

  // State
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAudienceDialog, setShowAudienceDialog] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [audienceSettings, setAudienceSettings] = useState(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState(null);

  // Load surveys
  useEffect(() => {
    loadSurveys();
  }, [businessId]);

  const loadSurveys = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/businesses/${businessId}/surveys`);
      setSurveys(response.data.surveys);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load surveys');
    } finally {
      setLoading(false);
    }
  };

  // Load audience settings for a survey
  const loadAudienceSettings = async (surveyId) => {
    try {
      setAudienceLoading(true);
      const response = await api.get(`/businesses/${businessId}/surveys/${surveyId}/audience`);
      setAudienceSettings(response.data);
    } catch (err) {
      setAudienceError(err.response?.data?.error || 'Failed to load audience settings');
    } finally {
      setAudienceLoading(false);
    }
  };

  // Handlers
  const handleCreateSurvey = () => {
    navigate(`/businesses/${businessId}/surveys/new`);
  };

  const handleEditSurvey = (surveyId) => {
    navigate(`/businesses/${businessId}/surveys/${surveyId}/edit`);
  };

  const handleViewSurvey = (surveyId) => {
    navigate(`/businesses/${businessId}/surveys/${surveyId}`);
  };

  const handleDeleteSurvey = async (surveyId) => {
    if (!window.confirm('Are you sure you want to delete this survey?')) return;

    try {
      await api.delete(`/businesses/${businessId}/surveys/${surveyId}`);
      loadSurveys();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete survey');
    }
  };

  const handleViewAnalytics = (surveyId) => {
    navigate(`/businesses/${businessId}/surveys/${surveyId}/analytics`);
  };

  const handleManageAudience = async (survey) => {
    setSelectedSurvey(survey);
    await loadAudienceSettings(survey.id);
    setShowAudienceDialog(true);
  };

  const handleSaveAudience = async (settings) => {
    try {
      setAudienceLoading(true);
      await api.put(`/businesses/${businessId}/surveys/${selectedSurvey.id}/audience`, settings);
      setShowAudienceDialog(false);
      loadSurveys();
    } catch (err) {
      setAudienceError(err.response?.data?.error || 'Failed to update audience settings');
    } finally {
      setAudienceLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container alignItems="center" spacing={2}>
          <Grid item xs>
            <Typography variant="h5">Surveys</Typography>
          </Grid>
          {isAdmin && (
            <Grid item>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateSurvey}
              >
                Create Survey
              </Button>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Surveys Grid */}
      <Grid container spacing={2}>
        {surveys.map((survey) => (
          <Grid item xs={12} sm={6} md={4} key={survey.id}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {survey.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {survey.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Chip
                    label={survey.published ? 'Published' : 'Draft'}
                    color={survey.published ? 'success' : 'default'}
                    size="small"
                  />
                  {survey.is_quickpoll && (
                    <Chip label="Quick Poll" color="info" size="small" />
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Responses: {survey.response_count}
                </Typography>
              </CardContent>
              <CardActions>
                <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                  <Box>
                    <Tooltip title="View Survey">
                      <IconButton onClick={() => handleViewSurvey(survey.id)}>
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Share">
                      <IconButton onClick={() => handleManageAudience(survey)}>
                        <ShareIcon />
                      </IconButton>
                    </Tooltip>
                    {isAdmin && (
                      <Tooltip title="Analytics">
                        <IconButton onClick={() => handleViewAnalytics(survey.id)}>
                          <AnalyticsIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                  {isAdmin && (
                    <Box>
                      <Tooltip title="Edit">
                        <IconButton onClick={() => handleEditSurvey(survey.id)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          onClick={() => handleDeleteSurvey(survey.id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Audience Settings Dialog */}
      <Dialog
        open={showAudienceDialog}
        onClose={() => setShowAudienceDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Manage Survey Access
        </DialogTitle>
        <DialogContent>
          {selectedSurvey && (
            <AudienceSelection
              type="survey"
              businessId={businessId}
              initialSettings={audienceSettings}
              onSave={handleSaveAudience}
              loading={audienceLoading}
              error={audienceError}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAudienceDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BusinessSurveys; 
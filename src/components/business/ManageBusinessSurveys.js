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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Share as ShareIcon,
  Analytics as AnalyticsIcon,
  Public as PublicIcon,
  Lock as LockIcon
} from '@mui/icons-material';
import AudienceSelection from '../common/AudienceSelection';
import { businessAPI } from '../../services/apiClient';
import toast from 'react-hot-toast';

const ManageBusinessSurveys = () => {
  // Get businessId from URL params (for Super Admin) or user context (for Business Admin)
  const { businessId: urlBusinessId } = useParams();
  const navigate = useNavigate();
  
  // Get user data from localStorage
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = localStorage.getItem('userRole');
  
  // Determine effective businessId based on role and context
  const effectiveBusinessId = urlBusinessId || user.business_id;
  const isSuperAdmin = userRole === 'super_admin';

  // State
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAudienceDialog, setShowAudienceDialog] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [audienceSettings, setAudienceSettings] = useState(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState(null);
  const [businessName, setBusinessName] = useState('');

  // Load surveys
  useEffect(() => {
    if (!effectiveBusinessId) {
      setError('No business context available.');
      setLoading(false);
      return;
    }
    loadSurveys();
  }, [effectiveBusinessId]);

  const loadSurveys = async () => {
    try {
      setLoading(true);
      const response = await businessAPI.getSurveysForBusiness(effectiveBusinessId);
      setSurveys(response.data.surveys);
      setBusinessName(response.data.business_name);
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
      const response = await businessAPI.getSurveyAudienceSettings(effectiveBusinessId, surveyId);
      // Map access_type to audience_type for compatibility with AudienceSelection component
      const rawSettings = response.data;
      const mappedSettings = {
        ...rawSettings,
        audience_type: rawSettings.access_type // Map access_type to audience_type
      };
      setAudienceSettings(mappedSettings);
    } catch (err) {
      setAudienceError(err.response?.data?.error || 'Failed to load audience settings');
    } finally {
      setAudienceLoading(false);
    }
  };

  // Handlers
  const handleCreateSurvey = () => {
    // Both super admin and business admin use the same business-specific route
    navigate(`/admin/business/${effectiveBusinessId}/surveys/new`, {
      state: { businessId: effectiveBusinessId, businessName }
    });
  };

  const handleEditSurvey = (surveyId) => {
    // Navigate to the business-specific survey edit route
    // Both super admin and business admin use the same business-specific route
    navigate(`/admin/business/${effectiveBusinessId}/surveys/${surveyId}/edit`, {
      state: {
        editMode: true,
        surveyId: surveyId,
        businessId: effectiveBusinessId,
        businessName: businessName
      }
    });
  };

  const handleViewSurvey = (surveyId) => {
    // Both super admin and business admin use the same business-specific route
    navigate(`/admin/business/${effectiveBusinessId}/surveys/${surveyId}`);
  };

  const handleTogglePublish = async (surveyId, currentStatus, surveyTitle) => {
    const newStatus = !currentStatus;
    const action = newStatus ? 'publish' : 'close';
    if (window.confirm(`Are you sure you want to ${action} the survey "${surveyTitle}"?`)) {
      try {
        if (newStatus) {
          await businessAPI.publishSurveyForBusiness(effectiveBusinessId, surveyId);
        } else {
          await businessAPI.unpublishSurveyForBusiness(effectiveBusinessId, surveyId);
        }
        toast.success(`Survey "${surveyTitle}" ${newStatus ? 'published' : 'closed'} successfully.`);
        loadSurveys(); // Refresh
      } catch (error) {
        console.error(`Error ${action}ing survey:`, error);
        toast.error(error.response?.data?.error || `Failed to ${action} survey.`);
      }
    }
  };

  const handleDeleteSurvey = async (surveyId) => {
    if (!window.confirm('Are you sure you want to delete this survey?')) return;

    try {
      await businessAPI.deleteSurveyFromBusiness(effectiveBusinessId, surveyId);
      toast.success('Survey deleted successfully.');
      loadSurveys();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete survey');
    }
  };

  const handleViewAnalytics = (surveyId) => {
    navigate(`/analytics/${surveyId}`, {
      state: { businessId: effectiveBusinessId }
    });
  };

  const handleManageAudience = async (survey) => {
    setSelectedSurvey(survey);
    await loadAudienceSettings(survey.id);
    setShowAudienceDialog(true);
  };

  const handleSaveAudience = async (settings) => {
    try {
      setAudienceLoading(true);
      await businessAPI.updateSurveyAudienceSettings(effectiveBusinessId, selectedSurvey.id, settings);
      toast.success('Audience settings updated successfully.');
      setShowAudienceDialog(false);
      loadSurveys();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update audience settings');
    } finally {
      setAudienceLoading(false);
    }
  };

  const handleUnpublishSurvey = async (surveyId, surveyTitle) => {
    if (window.confirm(`Are you sure you want to unpublish survey "${surveyTitle}"? This will make it unavailable to users.`)) {
      try {
        await businessAPI.unpublishSurveyForBusiness(effectiveBusinessId, surveyId);
        toast.success(`Survey "${surveyTitle}" unpublished successfully!`);
        loadSurveys(); // Refresh list
      } catch (error) {
        console.error('Error unpublishing survey:', error);
        toast.error(error.response?.data?.error || 'Failed to unpublish survey.');
      }
    }
  };

  const handleArchiveSurvey = async (surveyId, surveyTitle) => {
    if (window.confirm(`Are you sure you want to archive survey "${surveyTitle}"? Archived surveys are not publicly visible but data is retained.`)) {
      try {
        await businessAPI.archiveSurveyForBusiness(effectiveBusinessId, surveyId);
        toast.success(`Survey "${surveyTitle}" archived successfully.`);
        loadSurveys(); // Refresh list
      } catch (error) {
        console.error('Error archiving survey:', error);
        toast.error(error.response?.data?.error || 'Failed to archive survey.');
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {businessName ? `Surveys - ${businessName}` : 'Manage Surveys'}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreateSurvey}
        >
          Create Survey
        </Button>
      </Box>

      {surveys.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography>No surveys found. Create your first survey to get started!</Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {surveys.map((survey) => (
            <Grid item xs={12} sm={6} md={4} key={survey.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {survey.title}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {survey.description || 'No description'}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      icon={survey.published ? <PublicIcon /> : <LockIcon />}
                      label={survey.published ? 'Published' : 'Draft'}
                      color={survey.published ? 'success' : 'default'}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    <Chip
                      label={`${survey.response_count} Responses`}
                      size="small"
                      color="primary"
                    />
                  </Box>
                </CardContent>
                <CardActions>
                  <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                    <Box>
                      <Tooltip title="View Survey">
                        <IconButton onClick={() => handleViewSurvey(survey.id)}>
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Audience">
                        <IconButton onClick={() => handleManageAudience(survey)}>
                          <ShareIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Analytics">
                        <IconButton onClick={() => handleViewAnalytics(survey.id)}>
                          <AnalyticsIcon />
                        </IconButton>
                      </Tooltip>
                      {!survey.is_archived && (
                        <>
                          {survey.published ? (
                            <Tooltip title="Unpublish Survey">
                              <IconButton 
                                onClick={() => handleUnpublishSurvey(survey.id, survey.title)}
                                color="warning"
                              >
                                <LockIcon />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Publish Survey">
                              <IconButton 
                                onClick={() => handleTogglePublish(survey.id, survey.published, survey.title)}
                                color="success"
                              >
                                <PublicIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </>
                      )}
                    </Box>
                    <Box>
                      <Tooltip title="Edit">
                        <IconButton 
                          onClick={() => handleEditSurvey(survey.id)}
                          disabled={survey.is_archived}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      {!survey.is_archived ? (
                        <Tooltip title="Archive Survey">
                          <IconButton
                            onClick={() => handleArchiveSurvey(survey.id, survey.title)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Survey Archived">
                          <span>
                            <IconButton disabled>
                              <DeleteIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

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

export default ManageBusinessSurveys; 
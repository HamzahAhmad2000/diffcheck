import React, { useState, useEffect } from 'react';
import { QrReader } from 'react-qr-reader';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress
} from '@mui/material';
import { QrCode as QrCodeIcon } from '@mui/icons-material';

const QRScanner = ({
  onScan,
  onError,
  loading = false,
  error = null,
  success = null
}) => {
  const [showScanner, setShowScanner] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);

  // Check camera permission
  useEffect(() => {
    if (showScanner) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => setHasPermission(true))
        .catch(() => setHasPermission(false));
    }
  }, [showScanner]);

  const handleScan = (result) => {
    if (result) {
      onScan(result);
      setShowScanner(false);
    }
  };

  const handleError = (error) => {
    onError(error);
    setShowScanner(false);
  };

  return (
    <Box>
      <Button
        variant="outlined"
        startIcon={<QrCodeIcon />}
        onClick={() => setShowScanner(true)}
        disabled={loading}
      >
        Scan QR Code
      </Button>

      <Dialog
        open={showScanner}
        onClose={() => setShowScanner(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Scan QR Code</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          )}
          {hasPermission === false && (
            <Alert severity="error">
              Camera access denied. Please enable camera access in your browser settings.
            </Alert>
          )}
          {hasPermission && (
            <Paper
              sx={{
                width: '100%',
                height: 300,
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              <QrReader
                constraints={{ facingMode: 'environment' }}
                onResult={handleScan}
                onError={handleError}
                style={{ width: '100%' }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none'
                }}
              >
                <Box
                  sx={{
                    width: 200,
                    height: 200,
                    border: '2px solid',
                    borderColor: 'primary.main',
                    borderRadius: 1
                  }}
                />
              </Box>
            </Paper>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Point your camera at a QR code to scan it
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowScanner(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QRScanner; 
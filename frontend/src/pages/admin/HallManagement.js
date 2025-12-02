import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography as MuiTypography
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { hallsAPI } from '../../api/halls';
import { cinemasAPI } from '../../api/cinemas';
import Loading from '../../components/Loading';

const HallManagement = () => {
  const [halls, setHalls] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHall, setEditingHall] = useState(null);
  const [expandedHall, setExpandedHall] = useState(null);
  const [formData, setFormData] = useState({
    cinema_id: '',
    name: '',
    hall_type: 'standard',
    capacity: 0,
    description: '',
    layout_configuration: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [hallsData, cinemasData] = await Promise.all([
        hallsAPI.getHalls(),
        cinemasAPI.getCinemas()
      ]);
      setHalls(hallsData);
      setCinemas(cinemasData);
    } catch (err) {
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (hall = null) => {
    if (hall) {
      setEditingHall(hall);
      setFormData({
        cinema_id: hall.cinema_id || '',
        name: hall.name || '',
        hall_type: hall.hall_type || 'standard',
        capacity: hall.capacity || 0,
        description: hall.description || '',
        layout_configuration: hall.layout_configuration || ''
      });
    } else {
      setEditingHall(null);
      setFormData({
        cinema_id: '',
        name: '',
        hall_type: 'standard',
        capacity: 0,
        description: '',
        layout_configuration: ''
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingHall(null);
    setFormData({
      cinema_id: '',
      name: '',
      hall_type: 'standard',
      capacity: 0,
      description: '',
      layout_configuration: ''
    });
  };

  const handleSubmit = async () => {
    try {
      const submitData = {
        ...formData,
        capacity: parseInt(formData.capacity)
      };
      
      if (editingHall) {
        await hallsAPI.updateHall(editingHall.id, submitData);
      } else {
        await hallsAPI.createHall(submitData);
      }
      await loadData();
      handleCloseDialog();
    } catch (err) {
      setError('Не удалось сохранить зал');
    }
  };

  const handleDelete = async (hallId) => {
    if (window.confirm('Удалить зал?')) {
      try {
        await hallsAPI.deleteHall(hallId);
        await loadData();
      } catch (err) {
        setError('Не удалось удалить зал');
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return <Loading message="Загрузка залов..." />;
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(135deg, #e50914 0%, #ffd700 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Управление залами
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{
            background: 'linear-gradient(135deg, #e50914 0%, #b00710 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #ff1a1a 0%, #cc0812 100%)',
            },
          }}
        >
          Добавить зал
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Кинотеатр</TableCell>
              <TableCell>Название</TableCell>
              <TableCell>Тип</TableCell>
              <TableCell>Вместимость</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {halls.map((hall) => (
              <TableRow key={hall.id}>
                <TableCell>{hall.id}</TableCell>
                <TableCell>{cinemas.find(c => c.id === hall.cinema_id)?.name || 'N/A'}</TableCell>
                <TableCell>{hall.name}</TableCell>
                <TableCell>{hall.hall_type}</TableCell>
                <TableCell>{hall.capacity}</TableCell>
                <TableCell>{hall.status}</TableCell>
                <TableCell>
                  <Button
                    startIcon={<EditIcon />}
                    onClick={() => handleOpenDialog(hall)}
                    color="primary"
                    size="small"
                    sx={{ mr: 1 }}
                  >
                    Редактировать
                  </Button>
                  <Button
                    startIcon={<DeleteIcon />}
                    onClick={() => handleDelete(hall.id)}
                    color="error"
                    size="small"
                  >
                    Удалить
                  </Button>
                  
                  <Accordion 
                    expanded={expandedHall === hall.id} 
                    onChange={(e, expanded) => setExpandedHall(expanded ? hall.id : null)}
                    sx={{ mt: 1, boxShadow: 'none' }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{ 
                        background: 'rgba(229, 9, 20, 0.1)', 
                        px: 2,
                        '&:hover': { background: 'rgba(229, 9, 20, 0.15)' }
                      }}
                    >
                      <MuiTypography variant="body2" color="text.secondary">
                        Конфигурация рассадки
                      </MuiTypography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <TextField
                        fullWidth
                        label="Конфигурация макета"
                        multiline
                        rows={4}
                        value={hall.layout_configuration || ''}
                        disabled
                        sx={{ mt: 2 }}
                      />
                    </AccordionDetails>
                  </Accordion>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Modal for creating/editing hall */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingHall ? 'Редактировать зал' : 'Добавить зал'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Кинотеатр</InputLabel>
                <Select
                  name="cinema_id"
                  value={formData.cinema_id}
                  onChange={handleInputChange}
                >
                  {cinemas.map((cinema) => (
                    <MenuItem key={cinema.id} value={cinema.id}>
                      {cinema.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Название зала"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Тип зала</InputLabel>
                <Select
                  name="hall_type"
                  value={formData.hall_type}
                  onChange={handleInputChange}
                >
                  <MenuItem value="standard">Обычный</MenuItem>
                  <MenuItem value="vip">VIP</MenuItem>
                  <MenuItem value="imax">IMAX</MenuItem>
                  <MenuItem value="four_dx">4DX</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Вместимость"
                type="number"
                name="capacity"
                value={formData.capacity}
                onChange={handleInputChange}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Конфигурация макета (JSON)"
                name="layout_configuration"
                value={formData.layout_configuration}
                onChange={handleInputChange}
                multiline
                rows={6}
                helperText="Опишите конфигурацию мест в формате JSON"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} startIcon={<CancelIcon />}>
            Отмена
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            startIcon={<SaveIcon />}
            sx={{
              background: 'linear-gradient(135deg, #46d369 0%, #2e7d32 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5ce67c 0%, #388e3c 100%)',
              },
            }}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default HallManagement;
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
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { distributorsAPI } from '../../api/distributors';
import Loading from '../../components/Loading';

const DistributorManagement = () => {
  const [distributors, setDistributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDistributor, setEditingDistributor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    inn: '',
    bank_details: '',
    status: 'active'
  });

  useEffect(() => {
    loadDistributors();
  }, []);

  const loadDistributors = async () => {
    try {
      setLoading(true);
      const data = await distributorsAPI.getDistributors();
      setDistributors(data);
    } catch (err) {
      setError('Не удалось загрузить дистрибьюторов');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (distributor = null) => {
    if (distributor) {
      setEditingDistributor(distributor);
      setFormData({
        name: distributor.name || '',
        contact_person: distributor.contact_person || '',
        email: distributor.email || '',
        phone: distributor.phone || '',
        inn: distributor.inn || '',
        bank_details: distributor.bank_details || '',
        status: distributor.status || 'active'
      });
    } else {
      setEditingDistributor(null);
      setFormData({
        name: '',
        contact_person: '',
        email: '',
        phone: '',
        inn: '',
        bank_details: '',
        status: 'active'
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingDistributor(null);
    setFormData({
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      inn: '',
      bank_details: '',
      status: 'active'
    });
  };

  const handleSubmit = async () => {
    try {
      if (editingDistributor) {
        await distributorsAPI.updateDistributor(editingDistributor.id, formData);
      } else {
        await distributorsAPI.createDistributor(formData);
      }
      await loadDistributors();
      handleCloseDialog();
    } catch (err) {
      setError('Не удалось сохранить дистрибьютора');
    }
  };

  const handleDelete = async (distributorId) => {
    if (window.confirm('Удалить дистрибьютора?')) {
      try {
        await distributorsAPI.deleteDistributor(distributorId);
        await loadDistributors();
      } catch (err) {
        setError('Не удалось удалить дистрибьютора');
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
    return <Loading message="Загрузка дистрибьюторов..." />;
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
          Управление дистрибьюторами
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
          Добавить дистрибьютора
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
              <TableCell>Название</TableCell>
              <TableCell>Контактное лицо</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Телефон</TableCell>
              <TableCell>ИНН</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {distributors.map((distributor) => (
              <TableRow key={distributor.id}>
                <TableCell>{distributor.id}</TableCell>
                <TableCell>{distributor.name}</TableCell>
                <TableCell>{distributor.contact_person}</TableCell>
                <TableCell>{distributor.email}</TableCell>
                <TableCell>{distributor.phone}</TableCell>
                <TableCell>{distributor.inn}</TableCell>
                <TableCell>{distributor.status}</TableCell>
                <TableCell>
                  <Button
                    startIcon={<EditIcon />}
                    onClick={() => handleOpenDialog(distributor)}
                    color="primary"
                    size="small"
                    sx={{ mr: 1 }}
                  >
                    Редактировать
                  </Button>
                  <Button
                    startIcon={<DeleteIcon />}
                    onClick={() => handleDelete(distributor.id)}
                    color="error"
                    size="small"
                  >
                    Удалить
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Modal for creating/editing distributor */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingDistributor ? 'Редактировать дистрибьютора' : 'Добавить дистрибьютора'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Контактное лицо"
                name="contact_person"
                value={formData.contact_person}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Телефон"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="ИНН"
                name="inn"
                value={formData.inn}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Банковские реквизиты"
                name="bank_details"
                value={formData.bank_details}
                onChange={handleInputChange}
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Статус</InputLabel>
                <Select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <MenuItem value="active">Активен</MenuItem>
                  <MenuItem value="inactive">Неактивен</MenuItem>
                  <MenuItem value="suspended">Приостановлен</MenuItem>
                </Select>
              </FormControl>
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

export default DistributorManagement;
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
  Tabs,
  Tab,
  Chip,
  Card,
  CardContent
} from '@mui/material';
import {
  Add as AddIcon,
  Receipt as ReceiptIcon,
  Download as DownloadIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { reportsAPI } from '../../api/reports';
import { paymentsAPI } from '../../api/payments';
import Loading from '../../components/Loading';

const ReportManagement = () => {
  const [reports, setReports] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportTab, setReportTab] = useState(0);
  const [reportParams, setReportParams] = useState({
    report_type: 'revenue',
    period_start: new Date().toISOString().substr(0, 10),
    period_end: new Date().toISOString().substr(0, 10),
    cinema_id: '',
    film_id: '',
    format: 'pdf'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reportsData, paymentsData] = await Promise.all([
        reportsAPI.getReports(),
        paymentsAPI.getPaymentHistory()
      ]);
      setReports(reportsData);
      setPayments(paymentsData);
    } catch (err) {
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = async (reportId) => {
    try {
      await reportsAPI.viewReport(reportId);
    } catch (err) {
      setError('Не удалось открыть отчет');
    }
  };

  const handleDownloadReport = async (reportId) => {
    try {
      await reportsAPI.downloadReport(reportId);
    } catch (err) {
      setError('Не удалось скачать отчет');
    }
  };

  const handleGenerateReport = async () => {
    try {
      await reportsAPI.generateReport(reportParams);
      await loadData();
      setDialogOpen(false);
    } catch (err) {
      setError('Не удалось сгенерировать отчет');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setReportParams(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return <Loading message="Загрузка отчетов..." />;
  }

  return (
    <Container maxWidth="xl" sx={{ py: 6 }}>
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
          Управление отчетами
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{
            background: 'linear-gradient(135deg, #e50914 0%, #b00710 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #ff1a1a 0%, #cc0812 100%)',
            },
          }}
        >
          Сформировать отчет
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Tabs
        value={reportTab}
        onChange={(e, newValue) => setReportTab(newValue)}
        sx={{ mb: 3 }}
      >
        <Tab label="Отчеты" />
        <Tab label="История оплат" />
      </Tabs>

      {reportTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3, background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)', border: '1px solid rgba(229, 9, 20, 0.2)' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: '#ffd700' }}>
                Доступные отчеты
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Тип отчета</TableCell>
                      <TableCell>Период</TableCell>
                      <TableCell>Дата создания</TableCell>
                      <TableCell>Статус</TableCell>
                      <TableCell>Формат</TableCell>
                      <TableCell>Действия</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>{report.id}</TableCell>
                        <TableCell>{report.type}</TableCell>
                        <TableCell>
                          {new Date(report.period_start).toLocaleDateString('ru-RU')} - {new Date(report.period_end).toLocaleDateString('ru-RU')}
                        </TableCell>
                        <TableCell>{new Date(report.created_at).toLocaleString('ru-RU')}</TableCell>
                        <TableCell>
                          <Chip
                            label={report.status}
                            color={report.status === 'completed' ? 'success' : report.status === 'failed' ? 'error' : 'warning'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{report.format}</TableCell>
                        <TableCell>
                          <Button
                            startIcon={<ReceiptIcon />}
                            onClick={() => handleViewReport(report.id)}
                            color="primary"
                            size="small"
                            sx={{ mr: 1 }}
                          >
                            Просмотр
                          </Button>
                          <Button
                            startIcon={<DownloadIcon />}
                            onClick={() => handleDownloadReport(report.id)}
                            variant="outlined"
                            size="small"
                          >
                            Скачать
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {reportTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3, background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)', border: '1px solid rgba(229, 9, 20, 0.2)' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: '#46d369' }}>
                История оплат
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Заказ</TableCell>
                      <TableCell>Сумма</TableCell>
                      <TableCell>Метод оплаты</TableCell>
                      <TableCell>Статус</TableCell>
                      <TableCell>Дата оплаты</TableCell>
                      <TableCell>Пользователь</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{payment.id}</TableCell>
                        <TableCell>#{payment.order_id}</TableCell>
                        <TableCell>{payment.amount} ₽</TableCell>
                        <TableCell>{payment.payment_method}</TableCell>
                        <TableCell>
                          <Chip
                            label={payment.status}
                            color={payment.status === 'paid' ? 'success' : payment.status === 'failed' ? 'error' : 'warning'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{new Date(payment.payment_date).toLocaleString('ru-RU')}</TableCell>
                        <TableCell>{payment.user_id}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Modal for generating report */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Сформировать новый отчет
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Тип отчета</InputLabel>
                <Select
                  name="report_type"
                  value={reportParams.report_type}
                  onChange={handleInputChange}
                >
                  <MenuItem value="revenue">Выручка</MenuItem>
                  <MenuItem value="popular_films">Популярные фильмы</MenuItem>
                  <MenuItem value="distributor_payments">Платежи дистрибьюторам</MenuItem>
                  <MenuItem value="concession_sales">Продажи кинобара</MenuItem>
                  <MenuItem value="user_activity">Активность пользователей</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Дата начала"
                type="date"
                name="period_start"
                value={reportParams.period_start}
                onChange={handleInputChange}
                InputLabelProps={{
                  shrink: true,
                }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Дата окончания"
                type="date"
                name="period_end"
                value={reportParams.period_end}
                onChange={handleInputChange}
                InputLabelProps={{
                  shrink: true,
                }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Формат отчета</InputLabel>
                <Select
                  name="format"
                  value={reportParams.format}
                  onChange={handleInputChange}
                >
                  <MenuItem value="pdf">PDF</MenuItem>
                  <MenuItem value="xlsx">Excel</MenuItem>
                  <MenuItem value="csv">CSV</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="ID Кинотеатра (необязательно)"
                name="cinema_id"
                value={reportParams.cinema_id}
                onChange={handleInputChange}
                type="number"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="ID Фильма (необязательно)"
                name="film_id"
                value={reportParams.film_id}
                onChange={handleInputChange}
                type="number"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} startIcon={<CancelIcon />}>
            Отмена
          </Button>
          <Button 
            onClick={handleGenerateReport} 
            variant="contained" 
            startIcon={<SaveIcon />}
            sx={{
              background: 'linear-gradient(135deg, #46d369 0%, #2e7d32 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5ce67c 0%, #388e3c 100%)',
              },
            }}
          >
            Сформировать
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ReportManagement;
import React, { useState, useEffect } from "react";
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
    DatePicker,
} from "@mui/material";
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
} from "@mui/icons-material";
import { contractsAPI } from "../../api/contracts";
import { distributorsAPI } from "../../api/distributors";
import { filmsAPI } from "../../api/films";
import Loading from "../../components/Loading";

const ContractManagement = () => {
    const [contracts, setContracts] = useState([]);
    const [distributors, setDistributors] = useState([]);
    const [films, setFilms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingContract, setEditingContract] = useState(null);
    const [formData, setFormData] = useState({
        film_id: "",
        distributor_id: "",
        contract_number: "",
        contract_date: "",
        rental_start_date: "",
        rental_end_date: "",
        terms: "",
        status: "active",
        distributor_percentage: 0,
        min_guarantee_amount: 0,
    });
    const [contractPayments, setContractPayments] = useState({});
    const [loadingPayments, setLoadingPayments] = useState({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [contractsData, distributorsData, filmsData] =
                await Promise.all([
                    contractsAPI.getContracts(),
                    distributorsAPI.getDistributors(),
                    filmsAPI.getFilms(),
                ]);
            setContracts(contractsData);
            setDistributors(distributorsData.items || distributorsData);
            setFilms(filmsData.items || filmsData);
        } catch (err) {
            setError("Не удалось загрузить данные");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (contract = null) => {
        if (contract) {
            setEditingContract(contract);
            setFormData({
                film_id: contract.film_id || "",
                distributor_id: contract.distributor_id || "",
                contract_number: contract.contract_number || "",
                contract_date: contract.contract_date
                    ? new Date(contract.contract_date)
                          .toISOString()
                          .split("T")[0]
                    : "",
                rental_start_date: contract.rental_start_date
                    ? new Date(contract.rental_start_date)
                          .toISOString()
                          .split("T")[0]
                    : "",
                rental_end_date: contract.rental_end_date
                    ? new Date(contract.rental_end_date)
                          .toISOString()
                          .split("T")[0]
                    : "",
                terms: contract.terms || "",
                status: contract.status || "active",
                distributor_percentage: contract.distributor_percentage || 0,
                min_guarantee_amount: contract.min_guarantee_amount || 0,
            });
        } else {
            setEditingContract(null);
            setFormData({
                film_id: "",
                distributor_id: "",
                contract_number: "",
                contract_date: new Date().toISOString().split("T")[0],
                rental_start_date: "",
                rental_end_date: "",
                terms: "",
                status: "active",
                distributor_percentage: 0,
                min_guarantee_amount: 0,
            });
        }
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingContract(null);
        setFormData({
            film_id: "",
            distributor_id: "",
            contract_number: "",
            contract_date: new Date().toISOString().split("T")[0],
            rental_start_date: "",
            rental_end_date: "",
            terms: "",
            status: "active",
            distributor_percentage: 0,
            min_guarantee_amount: 0,
        });
    };

    const handleSubmit = async () => {
        try {
            const submitData = {
                ...formData,
                distributor_percentage: parseFloat(
                    formData.distributor_percentage
                ),
                min_guarantee_amount: parseFloat(formData.min_guarantee_amount),
            };

            if (editingContract) {
                await contractsAPI.updateContract(
                    editingContract.id,
                    submitData
                );
            } else {
                await contractsAPI.createContract(submitData);
            }
            await loadData();
            handleCloseDialog();
        } catch (err) {
            setError("Не удалось сохранить договор");
        }
    };

    const handleDelete = async (contractId) => {
        if (window.confirm("Удалить договор?")) {
            try {
                await contractsAPI.deleteContract(contractId);
                await loadData();
            } catch (err) {
                setError("Не удалось удалить договор");
            }
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const loadContractPayments = async (contractId) => {
        try {
            setLoadingPayments(prev => ({ ...prev, [contractId]: true }));
            const payments = await contractsAPI.getContractPayments(contractId);
            setContractPayments(prev => ({
                ...prev,
                [contractId]: payments
            }));
        } catch (err) {
            console.error(`Failed to load payments for contract ${contractId}:`, err);
        } finally {
            setLoadingPayments(prev => ({ ...prev, [contractId]: false }));
        }
    };

    const handleMarkPaymentAsPaid = async (contractId, paymentId) => {
        try {
            await contractsAPI.markPaymentAsPaid(contractId, paymentId);
            // Reload contract payments to update the status
            await loadContractPayments(contractId);
        } catch (err) {
            setError('Не удалось отметить платёж как оплаченный: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleViewPayments = async (contract) => {
        try {
            setLoadingPayments(prev => ({ ...prev, [contract.id]: true }));
            const payments = await contractsAPI.getContractPayments(contract.id);
            setContractPayments(prev => ({
                ...prev,
                [contract.id]: payments
            }));
        } catch (err) {
            setError('Не удалось загрузить платежи для договора: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoadingPayments(prev => ({ ...prev, [contract.id]: false }));
        }
    };

    if (loading) {
        return <Loading message="Загрузка договоров..." />;
    }

    return (
        <Container
            maxWidth="lg"
            sx={{ py: 6 }}
        >
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 4,
                }}
            >
                <Typography
                    variant="h4"
                    sx={{
                        fontWeight: 700,
                        background:
                            "linear-gradient(135deg, #e50914 0%, #ffd700 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}
                >
                    Управление договорами
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                    sx={{
                        background:
                            "linear-gradient(135deg, #e50914 0%, #b00710 100%)",
                        "&:hover": {
                            background:
                                "linear-gradient(135deg, #ff1a1a 0%, #cc0812 100%)",
                        },
                    }}
                >
                    Добавить договор
                </Button>
            </Box>

            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 3 }}
                >
                    {error}
                </Alert>
            )}

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>ID</TableCell>
                            <TableCell>Номер договора</TableCell>
                            <TableCell>Фильм</TableCell>
                            <TableCell>Дистрибьютор</TableCell>
                            <TableCell>Дата договора</TableCell>
                            <TableCell>Срок действия</TableCell>
                            <TableCell>Комиссия (%)</TableCell>
                            <TableCell>Статус</TableCell>
                            <TableCell>Платежи</TableCell>
                            <TableCell>Действия</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {contracts.map((contract) => (
                            <TableRow key={contract.id}>
                                <TableCell>{contract.id}</TableCell>
                                <TableCell>
                                    {contract.contract_number}
                                </TableCell>
                                <TableCell>
                                    {films.find(
                                        (f) => f.id === contract.film_id
                                    )?.title || "N/A"}
                                </TableCell>
                                <TableCell>
                                    {distributors.find(
                                        (d) => d.id === contract.distributor_id
                                    )?.name || "N/A"}
                                </TableCell>
                                <TableCell>
                                    {new Date(
                                        contract.contract_date
                                    ).toLocaleDateString("ru-RU")}
                                </TableCell>
                                <TableCell>
                                    {new Date(
                                        contract.rental_start_date
                                    ).toLocaleDateString("ru-RU")}{" "}
                                    -{" "}
                                    {new Date(
                                        contract.rental_end_date
                                    ).toLocaleDateString("ru-RU")}
                                </TableCell>
                                <TableCell>
                                    {contract.distributor_percentage}%
                                </TableCell>
                                <TableCell>{contract.status}</TableCell>
                                <TableCell>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => handleViewPayments(contract)}
                                        disabled={loadingPayments[contract.id]}
                                        sx={{ mr: 1 }}
                                    >
                                        {loadingPayments[contract.id] ? 'Загрузка...' : 'Показать платежи'}
                                    </Button>

                                    {/* Show payment information if loaded */}
                                    {contractPayments[contract.id] && (
                                        <Box sx={{ mt: 1 }}>
                                            {contractPayments[contract.id].length > 0 ? (
                                                contractPayments[contract.id].slice(0, 2).map((payment, idx) => (
                                                    <Box key={payment.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                        <Typography variant="caption">
                                                            {payment.amount} ₽ ({payment.status})
                                                        </Typography>
                                                        {payment.status === 'PENDING' && (
                                                            <Button
                                                                size="small"
                                                                variant="contained"
                                                                onClick={() => handleMarkPaymentAsPaid(contract.id, payment.id)}
                                                                sx={{ minWidth: 'auto', padding: '2px 6px' }}
                                                            >
                                                                Оплатить
                                                            </Button>
                                                        )}
                                                    </Box>
                                                ))
                                            ) : (
                                                <Typography variant="caption" color="text.secondary">
                                                    Нет платежей
                                                </Typography>
                                            )}
                                        </Box>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Button
                                        startIcon={<EditIcon />}
                                        onClick={() =>
                                            handleOpenDialog(contract)
                                        }
                                        color="primary"
                                        size="small"
                                        sx={{ mr: 1 }}
                                    >
                                        Редактировать
                                    </Button>
                                    <Button
                                        startIcon={<DeleteIcon />}
                                        onClick={() =>
                                            handleDelete(contract.id)
                                        }
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

            {/* Modal for creating/editing contract */}
            <Dialog
                open={dialogOpen}
                onClose={handleCloseDialog}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    {editingContract
                        ? "Редактировать договор"
                        : "Добавить договор"}
                </DialogTitle>
                <DialogContent>
                    <Grid
                        container
                        spacing={2}
                        sx={{ mt: 1 }}
                    >
                        <Grid
                            item
                            xs={12}
                            sm={6}
                        >
                            <FormControl
                                fullWidth
                                required
                            >
                                <InputLabel>Фильм</InputLabel>
                                <Select
                                    name="film_id"
                                    value={formData.film_id}
                                    onChange={handleInputChange}
                                >
                                    {films.map((film) => (
                                        <MenuItem
                                            key={film.id}
                                            value={film.id}
                                        >
                                            {film.title}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid
                            item
                            xs={12}
                            sm={6}
                        >
                            <FormControl
                                fullWidth
                                required
                            >
                                <InputLabel>Дистрибьютор</InputLabel>
                                <Select
                                    name="distributor_id"
                                    value={formData.distributor_id}
                                    onChange={handleInputChange}
                                >
                                    {distributors.map((distributor) => (
                                        <MenuItem
                                            key={distributor.id}
                                            value={distributor.id}
                                        >
                                            {distributor.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid
                            item
                            xs={12}
                            sm={6}
                        >
                            <TextField
                                fullWidth
                                label="Номер договора"
                                name="contract_number"
                                value={formData.contract_number}
                                onChange={handleInputChange}
                                required
                            />
                        </Grid>
                        <Grid
                            item
                            xs={12}
                            sm={6}
                        >
                            <TextField
                                fullWidth
                                label="Дата договора"
                                type="date"
                                name="contract_date"
                                value={formData.contract_date}
                                onChange={handleInputChange}
                                InputLabelProps={{
                                    shrink: true,
                                }}
                                required
                            />
                        </Grid>
                        <Grid
                            item
                            xs={12}
                            sm={6}
                        >
                            <TextField
                                fullWidth
                                label="Дата начала"
                                type="date"
                                name="start_date"
                                value={formData.start_date}
                                onChange={handleInputChange}
                                InputLabelProps={{
                                    shrink: true,
                                }}
                                required
                            />
                        </Grid>
                        <Grid
                            item
                            xs={12}
                            sm={6}
                        >
                            <TextField
                                fullWidth
                                label="Дата окончания"
                                type="date"
                                name="end_date"
                                value={formData.end_date}
                                onChange={handleInputChange}
                                InputLabelProps={{
                                    shrink: true,
                                }}
                                required
                            />
                        </Grid>
                        <Grid
                            item
                            xs={12}
                            sm={6}
                        >
                            <TextField
                                fullWidth
                                label="Комиссия (%)"
                                type="number"
                                name="distributor_percentage"
                                value={formData.distributor_percentage}
                                onChange={handleInputChange}
                                required
                            />
                        </Grid>
                        <Grid
                            item
                            xs={12}
                            sm={6}
                        >
                            <TextField
                                fullWidth
                                label="Минимальная гарантия (руб)"
                                type="number"
                                name="min_guarantee_amount"
                                value={formData.min_guarantee_amount}
                                onChange={handleInputChange}
                            />
                        </Grid>
                        <Grid
                            item
                            xs={12}
                        >
                            <TextField
                                fullWidth
                                label="Условия"
                                name="terms"
                                value={formData.terms}
                                onChange={handleInputChange}
                                multiline
                                rows={4}
                            />
                        </Grid>
                        <Grid
                            item
                            xs={12}
                        >
                            <FormControl fullWidth>
                                <InputLabel>Статус</InputLabel>
                                <Select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                >
                                    <MenuItem value="active">Активен</MenuItem>
                                    <MenuItem value="expired">Истёк</MenuItem>
                                    <MenuItem value="terminated">
                                        Расторгнут
                                    </MenuItem>
                                    <MenuItem value="pending">
                                        Ожидает подписания
                                    </MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={handleCloseDialog}
                        startIcon={<CancelIcon />}
                    >
                        Отмена
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        variant="contained"
                        startIcon={<SaveIcon />}
                        sx={{
                            background:
                                "linear-gradient(135deg, #46d369 0%, #2e7d32 100%)",
                            "&:hover": {
                                background:
                                    "linear-gradient(135deg, #5ce67c 0%, #388e3c 100%)",
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

export default ContractManagement;

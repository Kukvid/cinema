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
} from "@mui/material";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { ru } from "date-fns/locale";
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
} from "@mui/icons-material";
import { useAuth } from "../../context/AuthContext";
import { contractsAPI } from "../../api/contracts";
import { distributorsAPI } from "../../api/distributors";
import { filmsAPI } from "../../api/films";
import Loading from "../../components/Loading";

const ContractManagement = () => {
    const { user } = useAuth();
    const [contracts, setContracts] = useState([]);
    const [distributors, setDistributors] = useState([]);
    const [films, setFilms] = useState([]);
    const [cinemas, setCinemas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingContract, setEditingContract] = useState(null);
    const [selectedCinema, setSelectedCinema] = useState(
        user.role === "admin" ? user.cinema_id : ""
    );
    const [formData, setFormData] = useState({
        film_id: "",
        distributor_id: "",
        cinema_id: user.role === "admin" ? user.cinema_id : "", // Auto populate for admin
        contract_number: "",
        contract_date: new Date().toISOString().split("T")[0], // Today's date
        rental_start_date: "",
        rental_end_date: "",
        distributor_percentage: 0,
    });

    useEffect(() => {
        loadData();
    }, [selectedCinema]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [distributorsData, filmsData, cinemasData] =
                await Promise.all([
                    distributorsAPI.getDistributors(),
                    filmsAPI.getFilms(),
                    contractsAPI.getAvailableCinemas(), // Use the new endpoint that respects user permissions
                ]);

            // Load contracts with cinema filter
            const contractsParams = {};
            if (selectedCinema) {
                contractsParams.cinema_id = selectedCinema;
            }
            const contractsData =
                await contractsAPI.getContracts(contractsParams);

            setContracts(contractsData);
            setDistributors(distributorsData.items || distributorsData);
            setFilms(filmsData.items || filmsData);
            setCinemas(cinemasData);
        } catch (err) {
            setError("Не удалось загрузить данные");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (contract = null) => {
        if (contract) {
            // Editing existing contract
            setEditingContract(contract);
            setFormData({
                film_id: contract.film_id || "",
                distributor_id: contract.distributor_id || "",
                cinema_id: contract.cinema_id || "",
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
                distributor_percentage: contract.distributor_percentage || 0,
            });
        } else {
            // Creating new contract
            setEditingContract(null);
            setFormData({
                film_id: "",
                distributor_id: "",
                cinema_id: user.role === "admin" ? user.cinema_id : "", // Auto populate for admin
                contract_number: "",
                contract_date: new Date().toISOString().split("T")[0], // Today's date
                rental_start_date: "",
                rental_end_date: "",
                distributor_percentage: 0,
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
            cinema_id: user.role === "admin" ? user.cinema_id : "", // Auto reset for admin
            contract_number: "",
            contract_date: new Date().toISOString().split("T")[0],
            rental_start_date: "",
            rental_end_date: "",
            distributor_percentage: 0,
        });
    };

    const handleSubmit = async () => {
        try {
            // Prepare the data to submit
            const submitData = {
                ...formData,
                distributor_percentage: parseFloat(
                    formData.distributor_percentage
                ),
                // Status is not included as it's automatically set to ACTIVE on creation
            };

            // Convert date strings to date objects for validation
            const contractDate = new Date(formData.contract_date);
            const startDate = new Date(formData.rental_start_date);
            const endDate = new Date(formData.rental_end_date);

            // Validation checks
            if (contractDate > new Date()) {
                throw new Error("Дата подписания не может быть в будущем");
            }

            if (startDate < new Date()) {
                throw new Error(
                    "Дата начала аренды не может быть раньше сегодняшней даты"
                );
            }

            if (endDate <= startDate) {
                throw new Error(
                    "Дата окончания аренды должна быть позже даты начала"
                );
            }

            if (contractDate > startDate) {
                throw new Error(
                    "Дата подписания не может быть позже даты начала аренды"
                );
            }

            if (editingContract) {
                // Update existing contract (only allow updating specific fields)
                const updateData = {
                    film_id: parseInt(formData.film_id),
                    distributor_id: parseInt(formData.distributor_id),
                    cinema_id: parseInt(formData.cinema_id),
                    contract_number: formData.contract_number,
                    contract_date: new Date(formData.contract_date),
                    rental_start_date: new Date(formData.rental_start_date),
                    rental_end_date: new Date(formData.rental_end_date),
                    distributor_percentage: parseFloat(formData.distributor_percentage),
                    // Don't allow status to be changed through this form
                };
                await contractsAPI.updateContract(
                    editingContract.id,
                    updateData
                );
            } else {
                // Create new contract with default ACTIVE status
                await contractsAPI.createContract(submitData);
            }
            await loadData();
            handleCloseDialog();
        } catch (err) {
            setError(
                "Не удалось сохранить договор: " +
                    (err.message ||
                        err.response?.data?.detail ||
                        "Неизвестная ошибка")
            );
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

    // Format date for display
    const formatDate = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    };

    // Get film by ID for display
    const getFilmById = (filmId) => {
        return (
            films.find((film) => film.id === filmId) || {
                title: "Неизвестный фильм",
            }
        );
    };

    // Get distributor by ID for display
    const getDistributorById = (distributorId) => {
        return (
            distributors.find(
                (distributor) => distributor.id === distributorId
            ) || { name: "Неизвестный дистрибьютор" }
        );
    };

    // Get cinema by ID for display
    const getCinemaById = (cinemaId) => {
        return (
            cinemas.find((cinema) => cinema.id === cinemaId) || {
                name: "Неизвестный кинотеатр",
            }
        );
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
                    mb: 2,
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
                            "linear-gradient(135deg, #e50914 0%, #ff6b6b 100%)",
                        "&:hover": {
                            background:
                                "linear-gradient(135deg, #ff6b6b 0%, #e50914 100%)",
                        },
                    }}
                >
                    Добавить договор
                </Button>
            </Box>

            {/* Cinema Filter for Super Admin */}
            {user.role === "super_admin" && (
                <Paper
                    sx={{
                        p: 2,
                        mb: 3,
                        background:
                            "linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)",
                    }}
                >
                    <Grid
                        container
                        spacing={2}
                        alignItems="center"
                    >
                        <Grid
                            item
                            xs={12}
                            md={6}
                        >
                            <FormControl
                                fullWidth
                                variant="outlined"
                            >
                                <InputLabel>Фильтр по кинотеатру</InputLabel>
                                <Select
                                    value={selectedCinema}
                                    onChange={(e) =>
                                        setSelectedCinema(e.target.value)
                                    }
                                    label="Фильтр по кинотеатру"
                                >
                                    <MenuItem value="">Все кинотеатры</MenuItem>
                                    {cinemas.map((cinema) => (
                                        <MenuItem
                                            key={cinema.id}
                                            value={cinema.id}
                                        >
                                            {cinema.name} - {cinema.city}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid
                            item
                            xs={12}
                            md={6}
                        >
                            <Typography
                                variant="body2"
                                color="text.secondary"
                            >
                                {selectedCinema
                                    ? `Показаны контракты для кинотеатра: ${cinemas.find((c) => c.id === parseInt(selectedCinema))?.name || ""}`
                                    : "Показаны контракты по всем кинотеатрам"}
                            </Typography>
                        </Grid>
                    </Grid>
                </Paper>
            )}

            {/* For admin user, show their cinema */}
            {user.role === "admin" && (
                <Paper
                    sx={{
                        p: 2,
                        mb: 3,
                        background:
                            "linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)",
                    }}
                >
                    <Grid
                        container
                        spacing={2}
                        alignItems="center"
                    >
                        <Grid
                            item
                            xs={12}
                        >
                            <Typography variant="body1">
                                Контракты для кинотеатра:{" "}
                                {cinemas.find((c) => c.id === user.cinema_id)
                                    ?.name || ""}{" "}
                                -{" "}
                                {cinemas.find((c) => c.id === user.cinema_id)
                                    ?.city || ""}
                            </Typography>
                        </Grid>
                    </Grid>
                </Paper>
            )}

            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 2 }}
                    onClose={() => setError(null)}
                >
                    {error}
                </Alert>
            )}

            <Paper
                elevation={3}
                sx={{
                    background:
                        "linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)",
                    border: "1px solid rgba(229, 9, 20, 0.3)",
                    overflow: "hidden",
                }}
            >
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow
                                sx={{
                                    "& th": {
                                        color: "#e50914",
                                        fontWeight: 700,
                                        fontSize: "1rem",
                                        borderBottom: "2px solid #e50914",
                                    },
                                }}
                            >
                                <TableCell sx={{ minWidth: 80 }}>
                                    № договора
                                </TableCell>
                                <TableCell sx={{ minWidth: 100 }}>
                                    Фильм
                                </TableCell>
                                <TableCell sx={{ minWidth: 100 }}>
                                    Дистрибьютор
                                </TableCell>
                                <TableCell sx={{ minWidth: 100 }}>
                                    Кинотеатр
                                </TableCell>
                                <TableCell sx={{ minWidth: 90 }}>
                                    Подписан
                                </TableCell>{" "}
                                <TableCell sx={{ minWidth: 90 }}>
                                    Начало
                                </TableCell>
                                <TableCell sx={{ minWidth: 90 }}>
                                    Окончание
                                </TableCell>
                                <TableCell sx={{ minWidth: 60 }}>%</TableCell>{" "}
                                <TableCell sx={{ minWidth: 80 }}>
                                    Статус
                                </TableCell>
                                <TableCell
                                    sx={{ minWidth: 100, textAlign: "center" }}
                                >
                                    Действия
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {contracts.map((contract) => (
                                <TableRow
                                    key={contract.id}
                                    sx={{
                                        "&:nth-of-type(even)": {
                                            backgroundColor:
                                                "rgba(255, 255, 255, 0.03)",
                                        },
                                        "&:hover": {
                                            backgroundColor:
                                                "rgba(229, 9, 20, 0.1)",
                                        },
                                    }}
                                >
                                    <TableCell
                                        sx={{
                                            fontWeight: "bold",
                                            color: "#ffd700",
                                        }}
                                    >
                                        {contract.contract_number}
                                    </TableCell>
                                    <TableCell>
                                        {getFilmById(contract.film_id).title}
                                    </TableCell>
                                    <TableCell>
                                        {
                                            getDistributorById(
                                                contract.distributor_id
                                            ).name
                                        }
                                    </TableCell>
                                    <TableCell>
                                        {getCinemaById(contract.cinema_id).name}
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(contract.contract_date)}
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(contract.rental_start_date)}
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(contract.rental_end_date)}
                                    </TableCell>
                                    <TableCell>
                                        {contract.distributor_percentage}%
                                    </TableCell>
                                    <TableCell>
                                        <Box
                                            component="span"
                                            sx={{
                                                px: 1.5,
                                                py: 0.5,
                                                borderRadius: 2,
                                                fontSize: "0.8rem",
                                                fontWeight: "bold",
                                                backgroundColor:
                                                    contract.status === "ACTIVE"
                                                        ? "rgba(76, 175, 80, 0.2)"
                                                        : contract.status ===
                                                            "EXPIRED"
                                                          ? "rgba(244, 67, 54, 0.2)"
                                                          : "rgba(255, 193, 7, 0.2)",
                                                color:
                                                    contract.status === "ACTIVE"
                                                        ? "#4caf50"
                                                        : contract.status === "EXPIRED"
                                                          ? "#f44336"
                                                          : contract.status === "PAID"
                                                          ? "#226d00ff"
                                                          : "#ffc107",
                                            }}
                                        > 
                                            {contract.status === "ACTIVE"
                                                ? "Активен"
                                                : contract.status === "EXPIRED"
                                                  ? "Просрочен"
                                                  : contract.status === "PENDING"
                                                  ? "Неоплачен"
                                                  : contract.status === "PAID"
                                                  ? "Оплачен"
                                                : contract.status}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                gap: 1,
                                                justifyContent: "center",
                                            }}
                                        >
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                // startIcon={<EditIcon />}
                                                onClick={() =>
                                                    handleOpenDialog(contract)
                                                }
                                                sx={{
                                                    borderColor: "#ffd700",
                                                    color: "#ffd700",
                                                    "&:hover": {
                                                        borderColor: "#ffed4e",
                                                        color: "#ffed4e",
                                                    },
                                                    minWidth: "32px",
                                                    padding: "6px",
                                                }}
                                            >
                                                <EditIcon
                                                    sx={{ fontSize: "1rem" }}
                                                />
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                // startIcon={<DeleteIcon />}
                                                onClick={() =>
                                                    handleDelete(contract.id)
                                                }
                                                sx={{
                                                    borderColor: "#f44336",
                                                    color: "#f44336",
                                                    "&:hover": {
                                                        borderColor: "#d32f2f",
                                                        color: "#d32f2f",
                                                    },
                                                    minWidth: "32px",
                                                    padding: "6px",
                                                }}
                                            >
                                                <DeleteIcon
                                                    sx={{ fontSize: "1rem" }}
                                                />
                                            </Button>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* Dialog for adding/editing contracts */}
            <Dialog
                open={dialogOpen}
                onClose={handleCloseDialog}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle
                    sx={{
                        background:
                            "linear-gradient(135deg, #e50914 0%, #ff6b6b 100%)",
                        color: "white",
                    }}
                >
                    {editingContract
                        ? "Редактировать договор"
                        : "Создать новый договор"}
                </DialogTitle>
                <LocalizationProvider
                    dateAdapter={AdapterDateFns}
                    adapterLocale={ru}
                >
                    <DialogContent sx={{ pt: 2 }}>
                        <Grid
                            container
                            spacing={2}
                            sx={{ mt: 1 }}
                        >
                            <Grid
                                item
                                xs={12}
                                md={6}
                            >
                                <TextField
                                    label="Номер договора"
                                    name="contract_number"
                                    value={formData.contract_number}
                                    onChange={handleInputChange}
                                    fullWidth
                                    required
                                    variant="outlined"
                                />
                            </Grid>
                            <Grid
                                item
                                xs={12}
                                md={6}
                            >
                                <FormControl
                                    fullWidth
                                    variant="outlined"
                                    required
                                >
                                    <InputLabel>Кинотеатр</InputLabel>
                                    <Select
                                        name="cinema_id"
                                        value={formData.cinema_id}
                                        onChange={handleInputChange}
                                        label="Кинотеатр"
                                        disabled={user.role === "admin"} // Admin cannot change cinema
                                    >
                                        {cinemas.map((cinema) => (
                                            <MenuItem
                                                key={cinema.id}
                                                value={cinema.id}
                                            >
                                                {cinema.name} - {cinema.city}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid
                                item
                                xs={12}
                                md={6}
                            >
                                <FormControl
                                    fullWidth
                                    variant="outlined"
                                    required
                                >
                                    <InputLabel>Фильм</InputLabel>
                                    <Select
                                        name="film_id"
                                        value={formData.film_id}
                                        onChange={handleInputChange}
                                        label="Фильм"
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
                                md={6}
                            >
                                <FormControl
                                    fullWidth
                                    variant="outlined"
                                    required
                                >
                                    <InputLabel>Дистрибьютор</InputLabel>
                                    <Select
                                        name="distributor_id"
                                        value={formData.distributor_id}
                                        onChange={handleInputChange}
                                        label="Дистрибьютор"
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
                                md={4}
                            >
                                <DatePicker
                                    label="Дата подписания"
                                    value={
                                        formData.contract_date
                                            ? new Date(formData.contract_date)
                                            : null
                                    }
                                    onChange={(date) => {
                                        if (date) {
                                            setFormData((prev) => ({
                                                ...prev,
                                                contract_date: date
                                                    .toISOString()
                                                    .split("T")[0],
                                            }));
                                        }
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            fullWidth
                                            required
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid
                                item
                                xs={12}
                                md={4}
                            >
                                <DatePicker
                                    label="Дата начала аренды"
                                    value={
                                        formData.rental_start_date
                                            ? new Date(
                                                  formData.rental_start_date
                                              )
                                            : null
                                    }
                                    onChange={(date) => {
                                        if (date) {
                                            setFormData((prev) => ({
                                                ...prev,
                                                rental_start_date: date
                                                    .toISOString()
                                                    .split("T")[0],
                                            }));
                                        }
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            fullWidth
                                            required
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid
                                item
                                xs={12}
                                md={4}
                            >
                                <DatePicker
                                    label="Дата окончания аренды"
                                    value={
                                        formData.rental_end_date
                                            ? new Date(formData.rental_end_date)
                                            : null
                                    }
                                    onChange={(date) => {
                                        if (date) {
                                            setFormData((prev) => ({
                                                ...prev,
                                                rental_end_date: date
                                                    .toISOString()
                                                    .split("T")[0],
                                            }));
                                        }
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            fullWidth
                                            required
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid
                                item
                                xs={12}
                            >
                                <TextField
                                    label="Процент дистрибьютора (%)"
                                    name="distributor_percentage"
                                    type="number"
                                    value={formData.distributor_percentage}
                                    onChange={handleInputChange}
                                    fullWidth
                                    variant="outlined"
                                    required
                                    InputProps={{
                                        inputProps: {
                                            min: 0,
                                            max: 100,
                                            step: 0.01,
                                        },
                                    }}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                </LocalizationProvider>
                <DialogActions sx={{ p: 2 }}>
                    <Button
                        onClick={handleCloseDialog}
                        startIcon={<CancelIcon />}
                        variant="outlined"
                        color="secondary"
                    >
                        Отмена
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        startIcon={<SaveIcon />}
                        variant="contained"
                        sx={{
                            background:
                                "linear-gradient(135deg, #e50914 0%, #ff6b6b 100%)",
                            "&:hover": {
                                background:
                                    "linear-gradient(135deg, #ff6b6b 0%, #e50914 100%)",
                            },
                        }}
                    >
                        {editingContract ? "Сохранить" : "Создать"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default ContractManagement;

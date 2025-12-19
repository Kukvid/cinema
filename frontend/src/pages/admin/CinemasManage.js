import React, { useState, useEffect } from "react";
import {
    Container,
    Typography,
    Box,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
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
} from "@mui/material";
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Place as PlaceIcon,
} from "@mui/icons-material";
import Loading from "../../components/Loading";
import { cinemasAPI } from "../../api/cinemas";
import { Controller, useForm } from "react-hook-form";

const CinemasManage = () => {
    const [cinemas, setCinemas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingCinema, setEditingCinema] = useState(null);
    const [formLoading, setFormLoading] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors },
    } = useForm({
        defaultValues: {
            name: "",
            address: "",
            city: "",
            phone: "",
            latitude: "",
            longitude: "",
            opening_date: "",
            status: "",
        },
    });

    useEffect(() => {
        loadCinemas();
    }, []);

    const loadCinemas = async () => {
        try {
            setLoading(true);
            const data = await cinemasAPI.getCinemas();
            setCinemas(data);
            setError(null);
        } catch (err) {
            setError("Не удалось загрузить кинотеатры");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (cinema = null) => {
        setEditingCinema(cinema);
        if (cinema) {
            reset(cinema);
        } else {
            reset({
                name: "",
                address: "",
                city: "",
                phone: "",
                latitude: "",
                longitude: "",
                opening_date: "",
                status: "",
            });
        }
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingCinema(null);
        reset();
    };

    const onSubmit = async (data) => {
        try {
            setFormLoading(true);
            if (editingCinema) {
                await cinemasAPI.updateCinema(editingCinema.id, data);
            } else {
                await cinemasAPI.createCinema(data);
            }
            await loadCinemas();
            handleCloseDialog();
        } catch (err) {
            setError("Не удалось сохранить кинотеатр");
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Удалить кинотеатр?")) {
            try {
                await cinemasAPI.deleteCinema(id);
                await loadCinemas();
            } catch (err) {
                setError("Не удалось удалить кинотеатр");
            }
        }
    };

    if (loading) {
        return <Loading message="Загрузка кинотеатров..." />;
    }

    return (
        <Container
            maxWidth="xl"
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
                    Управление кинотеатрами
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                    sx={{
                        background:
                            "linear-gradient(135deg, #e50914 0%, #b00710 100%)",
                    }}
                >
                    Добавить кинотеатр
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

            <TableContainer
                component={Paper}
                sx={{
                    background:
                        "linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)",
                    border: "1px solid rgba(229, 9, 20, 0.2)",
                }}
            >
                <Table>
                    <TableHead>
                        <TableRow sx={{ background: "rgba(229, 9, 20, 0.1)" }}>
                            <TableCell sx={{ fontWeight: 600 }}>
                                Название
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                                Город
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                                Адрес
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                                Телефон
                            </TableCell>
                            <TableCell
                                align="right"
                                sx={{ fontWeight: 600 }}
                            >
                                Действия
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {cinemas.map((cinema) => (
                            <TableRow
                                key={cinema.id}
                                hover
                            >
                                <TableCell>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                        }}
                                    >
                                        <PlaceIcon sx={{ color: "#e50914" }} />
                                        {cinema.name}
                                    </Box>
                                </TableCell>
                                <TableCell>{cinema.city}</TableCell>
                                <TableCell>{cinema.address}</TableCell>
                                <TableCell>{cinema.phone}</TableCell>
                                <TableCell align="right">
                                    <IconButton
                                        onClick={() => handleOpenDialog(cinema)}
                                        color="primary"
                                    >
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton
                                        onClick={() => handleDelete(cinema.id)}
                                        color="error"
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Dialog */}
            <Dialog
                open={dialogOpen}
                onClose={handleCloseDialog}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    {editingCinema
                        ? "Редактировать кинотеатр"
                        : "Добавить кинотеатр"}
                </DialogTitle>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <DialogContent>
                        <TextField
                            fullWidth
                            label="Название"
                            margin="normal"
                            {...register("name", {
                                required: "Название обязательно",
                            })}
                            error={!!errors.name}
                            helperText={errors.name?.message}
                        />
                        <TextField
                            fullWidth
                            label="Город"
                            margin="normal"
                            {...register("city", {
                                required: "Город обязателен",
                            })}
                            error={!!errors.city}
                            helperText={errors.city?.message}
                        />
                        <TextField
                            fullWidth
                            label="Адрес"
                            margin="normal"
                            {...register("address", {
                                required: "Адрес обязателен",
                            })}
                            error={!!errors.address}
                            helperText={errors.address?.message}
                        />
                        <TextField
                            fullWidth
                            label="Телефон"
                            margin="normal"
                            {...register("phone")}
                        />
                        <TextField
                            fullWidth
                            label="Широта"
                            margin="normal"
                            type="number"
                            required={false}
                            inputProps={{ step: "any" }}
                            {...register("latitude", {
                                setValueAs: (value) =>
                                    value === "" ? null : Number(value),
                                validate: (value) => {
                                    if (value === null || value === undefined)
                                        return true; // разрешаем null
                                    const numValue = Number(value);
                                    return (
                                        (numValue >= -90 && numValue <= 90) ||
                                        "Широта должна быть от -90 до 90"
                                    );
                                },
                            })}
                            error={!!errors.latitude}
                            helperText={errors.latitude?.message}
                        />
                        <TextField
                            fullWidth
                            label="Долгота"
                            margin="normal"
                            type="number"
                            required={false}
                            inputProps={{ step: "any" }}
                            {...register("longitude", {
                                setValueAs: (value) =>
                                    value === "" ? null : Number(value),
                                validate: (value) => {
                                    if (value === null || value === undefined)
                                        return true;
                                    const numValue = Number(value);
                                    return (
                                        (numValue >= -180 && numValue <= 180) ||
                                        "Долгота должна быть от -180 до 180"
                                    );
                                },
                            })}поле 
                            error={!!errors.longitude}
                            helperText={errors.longitude?.message}
                        />
                        <TextField
                            fullWidth
                            label="Дата открытия"
                            margin="normal"
                            type="date"
                            InputLabelProps={{ shrink: true }}
                            {...register("opening_date")}
                        />
                        <FormControl
                            fullWidth
                            margin="normal"
                            error={!!errors.status}
                        >
                            <InputLabel>Статус</InputLabel>
                            <Controller
                                name="status"
                                control={control}
                                defaultValue="ACTIVE"
                                rules={{ required: "Статус обязателен" }}
                                render={({ field }) => (
                                    <Select
                                        {...field}
                                        label="Статус"
                                    >
                                        <MenuItem value="ACTIVE">
                                            Активный
                                        </MenuItem>
                                        <MenuItem value="INACTIVE">
                                            Неактивный
                                        </MenuItem>
                                        <MenuItem value="CLOSED">
                                            Закрыт
                                        </MenuItem>
                                    </Select>
                                )}
                            />
                            {errors.status && (
                                <Typography
                                    variant="caption"
                                    color="error"
                                    sx={{ mt: 0.5, ml: 2 }}
                                >
                                    {errors.status.message}
                                </Typography>
                            )}
                        </FormControl>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDialog}>Отмена</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={formLoading}
                        >
                            {formLoading ? "Сохранение..." : "Сохранить"}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </Container>
    );
};

export default CinemasManage;

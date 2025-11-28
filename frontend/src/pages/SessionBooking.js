import React, { useState, useEffect } from "react";
import {
    Container,
    Grid,
    Typography,
    Box,
    Paper,
    Button,
    TextField,
    Divider,
    Card,
    CardContent,
    CardMedia,
    Checkbox,
    FormControlLabel,
    Alert,
    Chip,
    IconButton,
    Tabs,
    Tab,
    Snackbar,
} from "@mui/material";
import {
    Add as AddIcon,
    Remove as RemoveIcon,
    ConfirmationNumber as TicketIcon,
    AccessTime as TimeIcon,
    Place as PlaceIcon,
    EventSeat as SeatIcon,
    LocalOffer as PromoIcon,
    Payment as PaymentIcon,
} from "@mui/icons-material";
import { useParams, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import Loading from "../components/Loading";
import SeatMap from "../components/SeatMap";
import { sessionsAPI } from "../api/sessions";
import { concessionsAPI } from "../api/concessions";
import { bookingsAPI } from "../api/bookings";
import { useAuth } from "../context/AuthContext";

const SessionBooking = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();

    const [session, setSession] = useState(null);
    const [seats, setSeats] = useState([]);
    const [selectedSeats, setSelectedSeats] = useState([]);
    const [concessions, setConcessions] = useState([]);
    const [selectedConcessions, setSelectedConcessions] = useState({});
    const [promoCode, setPromoCode] = useState("");
    const [appliedPromo, setAppliedPromo] = useState(null);
    const [promoLoading, setPromoLoading] = useState(false);
    const [useBonuses, setUseBonuses] = useState(false);
    const [bonusAmount, setBonusAmount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [activeCategory, setActiveCategory] = useState("");
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: "",
        severity: "info",
    });

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
    try {
        setLoading(true);
        const sessionData = await sessionsAPI.getSessionById(id);
        const seatsData = await sessionsAPI.getSessionSeats(id);
        
        // Получаем cinema_id из сеанса
        const cinemaId = sessionData?.hall?.cinema?.id;
        
        // Передаём cinema_id в запрос
        const concessionsData = await concessionsAPI.getConcessionItems({ cinema_id: cinemaId });
        
        setSession(sessionData);
        setSeats(seatsData.seats ?? []);
        setConcessions(concessionsData);
        
        const categories = [...new Set(concessionsData.map(item => item.category?.name).filter(Boolean))];
        if (categories.length > 0) setActiveCategory(categories[0]);
        
        setError(null);
    } catch (err) {
        console.error("Failed to load session:", err);
        setError("Не удалось загрузить информацию о сеансе");
    } finally {
        setLoading(false);
    }
};


    const handleSeatSelect = (seat) => {
        setSelectedSeats((prev) =>
            prev.includes(seat.id)
                ? prev.filter((id) => id !== seat.id)
                : [...prev, seat.id]
        );
    };

    const handleConcessionChange = (item, change) => {
        const current = selectedConcessions[item.id] || 0;
        const totalItems = Object.values(selectedConcessions).reduce(
            (sum, qty) => sum + qty,
            0
        );

        if (change > 0) {
            if (totalItems >= 10) {
                setSnackbar({
                    open: true,
                    message: "Максимум 10 товаров в предзаказе",
                    severity: "warning",
                });
                return;
            }
            if (current >= item.stock_quantity) {
                setSnackbar({
                    open: true,
                    message: "Недостаточно товара на складе",
                    severity: "warning",
                });
                return;
            }
        }

        setSelectedConcessions((prev) => {
            const newValue = Math.max(0, current + change);
            if (newValue === 0) {
                const { [item.id]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [item.id]: newValue };
        });
    };

    const handleApplyPromo = async () => {
        if (!promoCode.trim()) return;

        try {
            setPromoLoading(true);
            // Замени на реальный endpoint
            const response = await fetch(`/api/promocodes/validate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: promoCode }),
            });

            if (!response.ok) {
                const data = await response.json();
                if (response.status === 404) {
                    setSnackbar({
                        open: true,
                        message: "Промокод не найден",
                        severity: "error",
                    });
                } else if (response.status === 400) {
                    setSnackbar({
                        open: true,
                        message: data.detail || "Промокод недействителен",
                        severity: "error",
                    });
                }
                return;
            }

            const promo = await response.json();
            setAppliedPromo(promo);
            setSnackbar({
                open: true,
                message: `Промокод применён! Скидка ${promo.discount_value}${promo.discount_type === "percentage" ? "%" : "₽"}`,
                severity: "success",
            });
        } catch (err) {
            setSnackbar({
                open: true,
                message: "Ошибка проверки промокода",
                severity: "error",
            });
        } finally {
            setPromoLoading(false);
        }
    };

    const calculateTotal = () => {
        const ticketsTotal =
            selectedSeats.length * (session?.ticket_price || 0);
        const concessionsTotal = Object.entries(selectedConcessions).reduce(
            (sum, [itemId, quantity]) => {
                const item = concessions.find((c) => c.id === parseInt(itemId));
                return sum + (parseFloat(item?.price) || 0) * quantity;
            },
            0
        );

        let total = ticketsTotal + concessionsTotal;

        // Применяем промокод
        if (appliedPromo) {
            if (appliedPromo.discount_type === "percentage") {
                total = total * (1 - appliedPromo.discount_value / 100);
            } else {
                total = Math.max(0, total - appliedPromo.discount_value);
            }
        }

        // Вычитаем бонусы
        if (useBonuses && bonusAmount > 0) {
            total = Math.max(0, total - bonusAmount);
        }

        return { ticketsTotal, concessionsTotal, total };
    };

    const handleBooking = async () => {
        if (!isAuthenticated) {
            navigate("/login");
            return;
        }
        if (selectedSeats.length === 0) {
            setError("Выберите хотя бы одно место");
            return;
        }

        try {
            setBookingLoading(true);
            setError(null);

            const bookingData = {
                session_id: parseInt(id),
                seat_ids: selectedSeats,
                concession_items: Object.entries(selectedConcessions).map(
                    ([id, quantity]) => ({
                        concession_id: parseInt(id),
                        quantity,
                    })
                ),
                promo_code: appliedPromo?.code || undefined,
                use_bonuses: useBonuses,
                bonus_amount: useBonuses ? bonusAmount : 0,
            };

            const booking = await bookingsAPI.createBooking(bookingData);
            await bookingsAPI.createPayment(booking.id, {
                amount: calculateTotal().total,
                payment_method: "card",
            });

            navigate("/my-tickets");
        } catch (err) {
            console.error("Booking failed:", err);
            setError(
                err.response?.data?.detail || "Не удалось создать бронирование"
            );
        } finally {
            setBookingLoading(false);
        }
    };

    const formatDate = (dateString) => {
        try {
            return format(parseISO(dateString), "d MMMM yyyy, HH:mm", {
                locale: ru,
            });
        } catch {
            return dateString;
        }
    };

    if (loading) {
        return <Loading message="Загрузка информации о сеансе..." />;
    }

    if (error && !session) {
        return (
            <Container sx={{ py: 4 }}>
                <Alert severity="error">{error}</Alert>
            </Container>
        );
    }

    const { ticketsTotal, concessionsTotal, total } = calculateTotal();
    const categories = [
        ...new Set(
            concessions.map((item) => item.category?.name).filter(Boolean)
        ),
    ];
    const filteredConcessions = concessions.filter(
        (item) => item.category?.name === activeCategory
    );

    return (
        <Container
            maxWidth="xl"
            sx={{ py: 4 }}
        >
            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 3 }}
                    onClose={() => setError(null)}
                >
                    {error}
                </Alert>
            )}

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
            >
                <Alert
                    severity={snackbar.severity}
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>

            <Grid
                container
                spacing={4}
            >
                <Grid
                    item
                    xs={12}
                    lg={8}
                >
                    {/* Информация о сеансе */}
                    <Paper
                        sx={{
                            p: 3,
                            mb: 3,
                            background:
                                "linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)",
                            border: "1px solid rgba(229, 9, 20, 0.3)",
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
                                md={8}
                            >
                                <Typography
                                    variant="h5"
                                    sx={{ fontWeight: 700, mb: 1 }}
                                >
                                    {session?.film?.title || "Фильм"}
                                </Typography>
                                <Box
                                    sx={{
                                        display: "flex",
                                        gap: 2,
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <Chip
                                        icon={<TimeIcon />}
                                        label={formatDate(
                                            session?.start_datetime
                                        )}
                                        sx={{
                                            background: "rgba(229, 9, 20, 0.2)",
                                        }}
                                    />
                                    <Chip
                                        icon={<PlaceIcon />}
                                        label={`${session?.hall?.cinema?.name}, Зал ${session?.hall?.name}`}
                                        sx={{
                                            background:
                                                "rgba(255, 215, 0, 0.2)",
                                        }}
                                    />
                                </Box>
                            </Grid>
                            <Grid
                                item
                                xs={12}
                                md={4}
                                sx={{ textAlign: { md: "right" } }}
                            >
                                <Typography
                                    variant="h6"
                                    color="text.secondary"
                                >
                                    Цена билета
                                </Typography>
                                <Typography
                                    variant="h4"
                                    sx={{ fontWeight: 700, color: "#46d369" }}
                                >
                                    {session?.ticket_price} ₽
                                </Typography>
                            </Grid>
                        </Grid>
                    </Paper>

                    {/* Схема зала */}
                    <Paper
                        sx={{
                            p: 3,
                            mb: 3,
                            background:
                                "linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)",
                            border: "1px solid rgba(229, 9, 20, 0.2)",
                        }}
                    >
                        <Typography
                            variant="h6"
                            sx={{ fontWeight: 600, mb: 3 }}
                        >
                            Выберите места
                        </Typography>
                        <SeatMap
                            seats={seats}
                            selectedSeats={selectedSeats}
                            onSeatSelect={handleSeatSelect}
                        />
                    </Paper>

                    {/* Кинобар */}
                    <Paper
                        sx={{
                            p: 3,
                            background:
                                "linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)",
                            border: "1px solid rgba(229, 9, 20, 0.2)",
                        }}
                    >
                        <Typography
                            variant="h6"
                            sx={{ fontWeight: 600, mb: 3 }}
                        >
                            Кинобар
                        </Typography>

                        <Tabs
                            value={activeCategory}
                            onChange={(e, newValue) =>
                                setActiveCategory(newValue)
                            }
                            variant="scrollable"
                            scrollButtons="auto"
                            sx={{
                                mb: 3,
                                borderBottom: 1,
                                borderColor: "divider",
                            }}
                        >
                            {categories.map((cat) => (
                                <Tab
                                    key={cat}
                                    label={cat}
                                    value={cat}
                                />
                            ))}
                        </Tabs>

                        <Grid
                            container
                            spacing={2}
                        >
                            {filteredConcessions.map((item) => {
                                const isOutOfStock = item.stock_quantity === 0;
                                return (
                                    <Grid
                                        item
                                        xs={12}
                                        sm={6}
                                        key={item.id}
                                    >
                                        <Card
                                            sx={{
                                                display: "flex",
                                                background: "#2a2a2a",
                                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                                position: "relative",
                                                opacity: isOutOfStock ? 0.5 : 1,
                                            }}
                                        >
                                            {isOutOfStock && (
                                                <Box
                                                    sx={{
                                                        position: "absolute",
                                                        inset: 0,
                                                        bgcolor:
                                                            "rgba(128, 128, 128, 0.7)",
                                                        zIndex: 1,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "center",
                                                    }}
                                                >
                                                    <Typography
                                                        variant="h6"
                                                        sx={{
                                                            color: "#fff",
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        Нет в наличии
                                                    </Typography>
                                                </Box>
                                            )}
                                            <CardMedia
                                                component="img"
                                                sx={{
                                                    width: 100,
                                                    objectFit: "cover",
                                                }}
                                                image={
                                                    item.image_url ||
                                                    "https://via.placeholder.com/100x100/2a2a2a/ffffff?text=Food"
                                                }
                                                alt={item.name}
                                            />
                                            <CardContent sx={{ flex: 1, p: 2 }}>
                                                <Typography
                                                    variant="body1"
                                                    sx={{ fontWeight: 600 }}
                                                >
                                                    {item.name}
                                                </Typography>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{
                                                        mb: 1,
                                                        fontSize: "0.85rem",
                                                    }}
                                                >
                                                    {item.description}
                                                </Typography>
                                                <Typography
                                                    variant="h6"
                                                    sx={{
                                                        color: "#46d369",
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {item.price} ₽
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                >
                                                    Осталось:{" "}
                                                    {item.stock_quantity}
                                                </Typography>
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 1,
                                                        mt: 1,
                                                    }}
                                                >
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            handleConcessionChange(
                                                                item,
                                                                -1
                                                            )
                                                        }
                                                        disabled={
                                                            !selectedConcessions[
                                                                item.id
                                                            ] || isOutOfStock
                                                        }
                                                        sx={{
                                                            background:
                                                                "rgba(229, 9, 20, 0.2)",
                                                        }}
                                                    >
                                                        <RemoveIcon />
                                                    </IconButton>
                                                    <Typography
                                                        sx={{
                                                            minWidth: 30,
                                                            textAlign: "center",
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {selectedConcessions[
                                                            item.id
                                                        ] || 0}
                                                    </Typography>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            handleConcessionChange(
                                                                item,
                                                                1
                                                            )
                                                        }
                                                        disabled={isOutOfStock}
                                                        sx={{
                                                            background:
                                                                "rgba(46, 125, 50, 0.2)",
                                                        }}
                                                    >
                                                        <AddIcon />
                                                    </IconButton>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    </Paper>
                </Grid>

                {/* Правая колонка */}
                <Grid
                    item
                    xs={12}
                    lg={4}
                >
                    <Paper
                        sx={{
                            p: 3,
                            background:
                                "linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)",
                            border: "2px solid rgba(229, 9, 20, 0.3)",
                        }}
                    >
                        <Typography
                            variant="h6"
                            sx={{ fontWeight: 700, mb: 3 }}
                        >
                            Ваш заказ
                        </Typography>

                        <Box sx={{ mb: 3 }}>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mb: 1 }}
                            >
                                Выбрано мест: {selectedSeats.length}
                            </Typography>
                            {selectedSeats.length > 0 && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        gap: 0.5,
                                        flexWrap: "wrap",
                                    }}
                                >
                                    {selectedSeats.map((seatId) => {
                                        const seat = seats.find(
                                            (s) => s.id === seatId
                                        );
                                        return (
                                            <Chip
                                                key={seatId}
                                                icon={<SeatIcon />}
                                                label={`Ряд ${seat?.row_number}, Место ${seat?.seat_number}`}
                                                size="small"
                                                sx={{
                                                    background:
                                                        "rgba(33, 150, 243, 0.2)",
                                                }}
                                            />
                                        );
                                    })}
                                </Box>
                            )}
                        </Box>

                        <Divider
                            sx={{ my: 2, borderColor: "rgba(229, 9, 20, 0.2)" }}
                        />

                        <Box sx={{ mb: 2 }}>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    mb: 1,
                                }}
                            >
                                <Typography>
                                    Билеты ({selectedSeats.length})
                                </Typography>
                                <Typography sx={{ fontWeight: 600 }}>
                                    {ticketsTotal} ₽
                                </Typography>
                            </Box>
                            {concessionsTotal > 0 && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        mb: 1,
                                    }}
                                >
                                    <Typography>Кинобар</Typography>
                                    <Typography sx={{ fontWeight: 600 }}>
                                        {concessionsTotal} ₽
                                    </Typography>
                                </Box>
                            )}
                        </Box>

                        <Divider
                            sx={{ my: 2, borderColor: "rgba(229, 9, 20, 0.2)" }}
                        />

                        {/* Промокод */}
                        <Box sx={{ mb: 2 }}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Промокод"
                                value={promoCode}
                                onChange={(e) => setPromoCode(e.target.value)}
                                disabled={!!appliedPromo}
                                sx={{ mb: 1 }}
                                InputProps={{
                                    startAdornment: (
                                        <PromoIcon
                                            sx={{ mr: 1, color: "#ffd700" }}
                                        />
                                    ),
                                }}
                            />
                            <Button
                                fullWidth
                                variant="outlined"
                                onClick={handleApplyPromo}
                                disabled={
                                    !promoCode.trim() ||
                                    promoLoading ||
                                    !!appliedPromo
                                }
                                sx={{
                                    borderColor: "#ffd700",
                                    color: "#ffd700",
                                    "&:hover": {
                                        borderColor: "#ffed4e",
                                        bgcolor: "rgba(255, 215, 0, 0.1)",
                                    },
                                }}
                            >
                                {promoLoading
                                    ? "Проверка..."
                                    : appliedPromo
                                      ? "Промокод применён"
                                      : "Применить промокод"}
                            </Button>
                            {appliedPromo && (
                                <Alert
                                    severity="success"
                                    sx={{ mt: 1 }}
                                >
                                    Скидка: {appliedPromo.discount_value}
                                    {appliedPromo.discount_type === "percentage"
                                        ? "%"
                                        : "₽"}
                                </Alert>
                            )}
                        </Box>

                        {/* Бонусы */}
                        {isAuthenticated && user?.bonus_balance > 0 && (
                            <Box sx={{ mb: 2 }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={useBonuses}
                                            onChange={(e) =>
                                                setUseBonuses(e.target.checked)
                                            }
                                        />
                                    }
                                    label={`Использовать бонусы (доступно: ${user.bonus_balance})`}
                                />
                                {useBonuses && (
                                    <TextField
                                        fullWidth
                                        size="small"
                                        type="number"
                                        label="Количество бонусов"
                                        value={bonusAmount}
                                        onChange={(e) =>
                                            setBonusAmount(
                                                Math.min(
                                                    parseInt(e.target.value) ||
                                                        0,
                                                    user.bonus_balance,
                                                    total
                                                )
                                            )
                                        }
                                        inputProps={{
                                            min: 0,
                                            max: Math.min(
                                                user.bonus_balance,
                                                total
                                            ),
                                        }}
                                        sx={{ mt: 1 }}
                                    />
                                )}
                            </Box>
                        )}

                        <Divider
                            sx={{ my: 2, borderColor: "rgba(229, 9, 20, 0.2)" }}
                        />

                        <Box sx={{ mb: 3 }}>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}
                            >
                                <Typography
                                    variant="h6"
                                    sx={{ fontWeight: 700 }}
                                >
                                    Итого
                                </Typography>
                                <Typography
                                    variant="h4"
                                    sx={{ fontWeight: 700, color: "#46d369" }}
                                >
                                    {total.toFixed(2)} ₽
                                </Typography>
                            </Box>
                        </Box>
                    </Paper>

                    {/* Кнопка оплаты внизу */}
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        startIcon={<PaymentIcon />}
                        onClick={handleBooking}
                        disabled={selectedSeats.length === 0 || bookingLoading}
                        sx={{
                            mt: 2,
                            py: 1.5,
                            fontSize: "1.1rem",
                            fontWeight: 600,
                            background:
                                "linear-gradient(135deg, #e50914 0%, #b00710 100%)",
                            "&:hover": {
                                background:
                                    "linear-gradient(135deg, #ff1a1a 0%, #cc0812 100%)",
                                transform: "translateY(-2px)",
                                boxShadow: "0 6px 20px rgba(229, 9, 20, 0.4)",
                            },
                            transition: "all 0.3s ease",
                        }}
                    >
                        {bookingLoading ? "Обработка..." : "Оплатить"}
                    </Button>
                </Grid>
            </Grid>
        </Container>
    );
};

export default SessionBooking;

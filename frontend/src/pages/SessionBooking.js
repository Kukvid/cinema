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
    AccessTime as TimeIcon,
    Place as PlaceIcon,
    EventSeat as SeatIcon,
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
import { getFoodCategories } from "../api/foodCategories";
import { useAuth } from "../context/AuthContext";
import PromoCodeInput from "../components/PromoCodeInput";
import AuthModal from "../components/AuthModal";

const SessionBooking = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();

    const [session, setSession] = useState(null);
    const [seats, setSeats] = useState([]);
    const [selectedSeats, setSelectedSeats] = useState([]);
    const [concessions, setConcessions] = useState([]);
    const [selectedConcessions, setSelectedConcessions] = useState({});
    const [appliedPromo, setAppliedPromo] = useState(null);
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
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [shouldBookAfterAuth, setShouldBookAfterAuth] = useState(false);

    useEffect(() => {
        loadData();

        // Проверяем, есть ли сохраненные данные для бронирования
        const savedBookingData = localStorage.getItem("pendingBooking");
        const returnUrl = localStorage.getItem("bookingReturnUrl");

        if (
            savedBookingData &&
            returnUrl &&
            isAuthenticated &&
            returnUrl === `/sessions/${id}/booking`
        ) {
            // Если данные сохранены, пользователь аутентифицирован и мы на нужной странице
            const bookingData = JSON.parse(savedBookingData);

            // Восстанавливаем состояние
            setSelectedSeats(bookingData.selectedSeats || []);
            setSelectedConcessions(bookingData.selectedConcessions || {});
            setAppliedPromo(bookingData.appliedPromo || null);
            setUseBonuses(bookingData.useBonuses || false);
            setBonusAmount(bookingData.bonusAmount || 0);

            // Очищаем сохраненные данные
            localStorage.removeItem("pendingBooking");
            localStorage.removeItem("bookingReturnUrl");

            // Продолжаем процесс бронирования
            setTimeout(() => {
                handleBooking();
            }, 0);
        }
    }, [id, isAuthenticated]);

    const loadData = async () => {
        try {
            setLoading(true);
            const sessionData = await sessionsAPI.getSessionById(id);
            const seatsData = await sessionsAPI.getSessionSeats(id);

            // Получаем cinema_id из сеанса
            const cinemaId = sessionData?.hall?.cinema?.id;

            // Передаём cinema_id в запрос
            const [concessionsData, allCategories] = await Promise.all([
                concessionsAPI.getConcessionItems({
                    cinema_id: cinemaId,
                }),
                // Fetch all categories sorted by display_order to maintain proper ordering
                getFoodCategories(),
            ]);

            // Sort categories by display_order
            const sortedCategories = allCategories
                .filter((category) =>
                    concessionsData.some(
                        (item) =>
                            item.category && item.category.id === category.id
                    )
                )
                .sort((a, b) => a.display_order - b.display_order)
                .map((category) => category.name);

            setSession(sessionData);
            setSeats(seatsData.seats ?? []);
            setConcessions(concessionsData);

            if (sortedCategories.length > 0)
                setActiveCategory(sortedCategories[0]);

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

    const handleApplyPromo = (promoData) => {
        setAppliedPromo(promoData);
    };

    const calculateTotal = () => {
        const ticketsTotal =
            selectedSeats && session
                ? selectedSeats.length * (session.ticket_price || 0)
                : 0;

        const concessionsTotal = selectedConcessions
            ? Object.entries(selectedConcessions).reduce(
                  (sum, [itemId, quantity]) => {
                      const item = concessions.find(
                          (c) => c && c.id === parseInt(itemId)
                      );
                      return sum + (item?.price || 0) * quantity;
                  },
                  0
              )
            : 0;

        const subtotal = ticketsTotal + concessionsTotal;

        // Применяем промокод
        let discountAmount = 0;
        if (appliedPromo) {
            discountAmount = parseFloat(appliedPromo.discount_amount) || 0;
        }

        const totalAfterDiscount = Math.max(0, subtotal - discountAmount);

        // Вычитаем бонусы
        let bonusDeduction = 0;
        if (useBonuses && bonusAmount > 0) {
            // Ограничиваем бонусы максимальным значением, которое позволяет оставить минимум 11 ₽ к оплате
            const maxBonusForMinPayment = Math.max(0, totalAfterDiscount - 11);
            bonusDeduction = Math.min(
                parseFloat(bonusAmount) || 0,
                totalAfterDiscount, // Не больше общей суммы после скидки
                maxBonusForMinPayment // Не меньше, чем позволяет минимальная сумма оплаты
            );
        }

        const finalTotal = Math.max(0, totalAfterDiscount - bonusDeduction);

        return {
            ticketsTotal,
            concessionsTotal,
            subtotal, // Промежуточная сумма до скидок
            discountAmount,
            bonusDeduction,
            total: finalTotal, // Финальная сумма после всех скидок и бонусов
        };
    };

    const handleBooking = async () => {
        if (!isAuthenticated) {
            // Сохраняем текущие данные заказа в localStorage перед открытием модального окна
            const bookingDataToSave = {
                selectedSeats,
                selectedConcessions,
                appliedPromo,
                useBonuses,
                bonusAmount,
            };
            localStorage.setItem(
                "pendingBooking",
                JSON.stringify(bookingDataToSave)
            );
            localStorage.setItem("bookingReturnUrl", `/sessions/${id}/booking`);

            setAuthModalOpen(true);
            setShouldBookAfterAuth(true);
            return;
        }

        if (selectedSeats.length === 0) {
            setError("Выберите хотя бы одно место");
            return;
        }

        try {
            setBookingLoading(true);
            setError(null);

            // Создаем билеты из выбранных мест
            const tickets = selectedSeats.map((seat_id) => ({
                session_id: parseInt(id),
                seat_id: parseInt(seat_id),
                price: session?.ticket_price || 0, // используем цену сеанса
                sales_channel: "ONLINE",
            }));

            // Рассчитываем общую сумму заказа (билеты + кинобар)
            const ticketsTotal =
                selectedSeats.length * (session?.ticket_price || 0);
            const concessionsTotal = Object.entries(selectedConcessions).reduce(
                (sum, [itemId, quantity]) => {
                    const item = concessions.find(
                        (c) => c && c.id === parseInt(itemId)
                    );
                    return sum + (item?.price || 0) * quantity;
                },
                0
            );
            const totalOrderAmount = parseFloat(
                (ticketsTotal + concessionsTotal).toFixed(2)
            );

            const bookingData = {
                tickets: tickets,
                total_order_amount: totalOrderAmount, // передаем общую сумму заказа
                promocode_code: appliedPromo?.code || undefined,
                use_bonus_points: useBonuses
                    ? parseFloat(bonusAmount || 0)
                    : undefined, // поле из схемы OrderCreate
            };

            const booking = await bookingsAPI.createBooking(bookingData);

            // Если есть выбранные concession items, создаем предзаказы
            if (Object.keys(selectedConcessions).length > 0) {
                try {
                    // Подготавливаем список всех предзаказов для отправки за один раз
                    const preordersList = [];
                    for (const [concessionId, quantity] of Object.entries(
                        selectedConcessions
                    )) {
                        const concessionItem = concessions.find(
                            (item) => item.id === parseInt(concessionId)
                        );
                        if (concessionItem && quantity > 0) {
                            preordersList.push({
                                order_id: booking.id,
                                concession_item_id: parseInt(concessionId),
                                quantity: quantity,
                                unit_price: concessionItem.price,
                            });
                        }
                    }

                    // Создаем все предзаказы за один вызов, чтобы у них был одинаковый код получения
                    if (preordersList.length > 0) {
                        await concessionsAPI.createPreorderBatch(preordersList);
                    }
                } catch (preorderError) {
                    console.error("Failed to create preorders:", preorderError);
                    // Не прерываем основной заказ, если не удалось создать предзаказы на концессию
                }
            }

            // Вместо автоматической оплаты, перенаправляем на страницу оплаты
            navigate(`/payment/${booking.id}`);
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

    const calculatedValues = calculateTotal();
    const {
        ticketsTotal,
        concessionsTotal,
        subtotal,
        discountAmount,
        bonusDeduction,
        total,
    } = calculatedValues;
    const categories = [
        ...new Set(
            concessions.map((item) => item?.category?.name).filter(Boolean)
        ),
    ];
    const filteredConcessions = concessions.filter(
        (item) => item?.category?.name === activeCategory
    );
    const handleAuthSuccess = () => {
        // Закрываем модальное окно
        setAuthModalOpen(false);
        // Проверяем, нужно ли выполнить бронирование после аутентификации
        if (shouldBookAfterAuth) {
            // Даем время контексту аутентификации обновиться, затем запускаем бронирование
            setTimeout(() => {
                // Повторный вызов handleBooking теперь пройдет проверку isAuthenticated
                // и выполнит основную логику бронирования.
                // Убедитесь, что флаг сброшен до вызова, или сбросьте его внутри handleBooking при начале новой попытки.
                // В предложенном выше handleBooking, флаг сбрасывается в начале асинхронного выполнения.
                handleBooking();
            }, 100); // Небольшая задержка может помочь, но не всегда обязательна
        }
    };
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

            {/* ОСНОВНОЙ КОНТЕНТ */}
            <Grid
                container
                spacing={4}
                justifyContent="center"
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
                                    {"Фильм: " + session?.film_title || "Фильм"}
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
                                        label={`${session?.hall?.cinema?.name}, Зал ${session?.hall?.hall_number || session?.hall?.name}`}
                                        sx={{
                                            background:
                                                "rgba(255, 215, 0, 0.2)",
                                        }}
                                    />
                                    {session?.hall?.capacity && (
                                        <Chip
                                            icon={<SeatIcon />}
                                            label={`Вместимость: ${session?.hall?.capacity}`}
                                            sx={{
                                                background:
                                                    "rgba(70, 211, 105, 0.2)",
                                            }}
                                        />
                                    )}
                                    {session?.hall?.hall_type && (
                                        <Chip
                                            label={session?.hall?.hall_type}
                                            sx={{
                                                background:
                                                    "rgba(33, 150, 243, 0.2)",
                                            }}
                                        />
                                    )}
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
                                                minHeight: 120,
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
                                                    (
                                                        item.image_url || ""
                                                    ).trim() ||
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
            </Grid>

            {/* БЛОК "ВАШ ЗАКАЗ" ВНИЗУ */}
            <Grid
                container
                spacing={4}
                sx={{ mt: 1 }}
                justifyContent="center"
            >
                <Grid
                    item
                    xs={12}
                    lg={8}
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
                                    {ticketsTotal.toFixed(2)} ₽
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
                                        {concessionsTotal.toFixed(2)} ₽
                                    </Typography>
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
                                <Typography>Промежуточный итог</Typography>
                                <Typography sx={{ fontWeight: 600 }}>
                                    {subtotal.toFixed(2)} ₽
                                </Typography>
                            </Box>
                            {discountAmount > 0 && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        mb: 1,
                                    }}
                                >
                                    <Typography>Скидка по промокоду</Typography>
                                    <Typography
                                        sx={{
                                            fontWeight: 600,
                                            color: "#46d369",
                                        }}
                                    >
                                        -{discountAmount.toFixed(2)} ₽
                                    </Typography>
                                </Box>
                            )}
                            {bonusDeduction > 0 && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        mb: 1,
                                    }}
                                >
                                    <Typography>Списание бонусов</Typography>
                                    <Typography
                                        sx={{
                                            fontWeight: 600,
                                            color: "#46d369",
                                        }}
                                    >
                                        -{bonusDeduction.toFixed(2)} ₽
                                    </Typography>
                                </Box>
                            )}
                        </Box>

                        <PromoCodeInput
                            onApply={handleApplyPromo}
                            currentTotal={subtotal} // Передаем промежуточную сумму до скидок
                            disabled={selectedSeats.length === 0}
                        />

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
                                    label={`Использовать бонусы (доступно: ${user.bonus_balance.toFixed(2)})`}
                                />
                                {useBonuses && (
                                    <>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ display: "block", mb: 1 }}
                                        >
                                            Максимум можно использовать{" "}
                                            {Math.min(
                                                user.bonus_balance,
                                                (subtotal - discountAmount) *
                                                    0.99,
                                                subtotal - discountAmount - 11
                                            ).toFixed(2)}{" "}
                                            бонусов (до{" "}
                                            {Math.min(
                                                user.bonus_balance,
                                                (subtotal - discountAmount) *
                                                    0.99
                                            ).toFixed(2)}{" "}
                                            при условии оплаты минимум 11 ₽)
                                        </Typography>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            type="number"
                                            label="Количество бонусов"
                                            value={bonusAmount}
                                            onChange={(e) => {
                                                const totalAfterDiscount =
                                                    Math.max(
                                                        0,
                                                        subtotal -
                                                            discountAmount
                                                    );
                                                const maxBonusAllowed =
                                                    Math.min(
                                                        user?.bonus_balance ||
                                                            0,
                                                        totalAfterDiscount *
                                                            0.99 // 99% от общей суммы после промокода
                                                    );
                                                const minPaymentRequired = 11;
                                                const maxBonusBasedOnMinPayment =
                                                    Math.max(
                                                        0,
                                                        totalAfterDiscount -
                                                            minPaymentRequired
                                                    );
                                                const maxPossibleBonus =
                                                    Math.min(
                                                        maxBonusAllowed,
                                                        maxBonusBasedOnMinPayment
                                                    );

                                                const newBonusAmount = Math.min(
                                                    Math.max(
                                                        0,
                                                        parseFloat(
                                                            e.target.value
                                                        ) || 0
                                                    ),
                                                    maxPossibleBonus
                                                );
                                                setBonusAmount(newBonusAmount);
                                            }}
                                            inputProps={{
                                                min: 0,
                                                max: Math.min(
                                                    user?.bonus_balance || 0,
                                                    (subtotal -
                                                        discountAmount) *
                                                        0.99, // 99% от суммы после скидки
                                                    Math.max(
                                                        0,
                                                        subtotal -
                                                            discountAmount -
                                                            11
                                                    ) // чтобы осталось минимум 11 ₽
                                                ),
                                            }}
                                            sx={{ mt: 1 }}
                                        />
                                    </>
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
                                    Итого к оплате
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

                    {/* Кнопка оплаты ОТДЕЛЬНО под блоком */}
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

            {/* Компонент модального окна авторизации */}
            <AuthModal
                open={authModalOpen}
                onClose={() => {
                    setAuthModalOpen(false);
                    setShouldBookAfterAuth(false);
                }}
                onAuthSuccess={handleAuthSuccess} // Даем немного времени для обновления состояния аутентификации
            />
        </Container>
    );
};

export default SessionBooking;

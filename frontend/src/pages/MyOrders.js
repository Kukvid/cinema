import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    Container,
    Typography,
    Box,
    Tabs,
    Tab,
    Grid,
    Card,
    CardContent,
    Chip,
    Paper,
    Divider,
    Alert,
    CircularProgress,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    IconButton,
    Collapse,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Avatar,
} from "@mui/material";
import {
    ConfirmationNumber as TicketIcon,
    LocalCafe as ConcessionIcon,
    Payment as PaymentIcon,
    CreditCard as CreditCardIcon,
    QrCode as QrCodeIcon,
    CheckCircle as CheckIcon,
    Schedule as ScheduleIcon,
    ExpandMore as ExpandMoreIcon,
    ArrowBack as ArrowBackIcon,
    Receipt as ReceiptIcon,
    LocalOffer as LocalOfferIcon,
    AccessTime as TimeIcon,
    Place as PlaceIcon,
    EventSeat as SeatIcon,
} from "@mui/icons-material";
import { format, parseISO, isPast } from "date-fns";
import { ru } from "date-fns/locale";
import Loading from "../components/Loading";
import { bookingsAPI } from "../api/bookings";
import { paymentsAPI } from "../api/payments";

const MyOrders = () => {
    const [activeOrders, setActiveOrders] = useState([]);
    const [pastOrders, setPastOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [tabValue, setTabValue] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [activeCount, setActiveCount] = useState(0);
    const [pastCount, setPastCount] = useState(0);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [orderDetails, setOrderDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Для бесконечной прокрутки
    const activeSkipRef = useRef(0);
    const pastSkipRef = useRef(0);
    const observer = useRef();

    const LIMIT = 10; // Увеличил лимит до 20 как запрошено

    const { current: activeSkip } = activeSkipRef;
    const { current: pastSkip } = pastSkipRef;

    const formatDate = (dateString) => {
        try {
            return format(parseISO(dateString), "d MMMM yyyy, HH:mm", {
                locale: ru,
            });
        } catch {
            return dateString;
        }
    };

    const isOrderPast = (order) => {
        return (
            order.status === "cancelled" ||
            order.status === "completed" ||
            order.status === "used"
        );
    };

    const loadOrders = async (skip = 0, type = "active", append = false) => {
        if (loadingMore && append) return;

        try {
            if (!append) {
                setLoading(
                    type === "active"
                        ? !activeOrders.length
                        : !pastOrders.length
                );
            } else {
                setLoadingMore(true);
            }

            const response = await bookingsAPI.getMyBookingsPaginated(skip, LIMIT);

            // Filter orders based on status
            const orders = response;
            const activeOrdersList = orders.filter(
                (order) =>
                    order.status !== "cancelled" &&
                    order.status !== "used" &&
                    !isOrderPast(order)
            );
            const pastOrdersList = orders.filter(
                (order) =>
                    order.status === "cancelled" ||
                    order.status === "used" ||
                    isOrderPast(order)
            );

            if (type === "active") {
                if (append) {
                    setActiveOrders((prev) => [...prev, ...activeOrdersList]);
                } else {
                    setActiveOrders(activeOrdersList);
                    setActiveCount(activeOrdersList.length);

                }
                // Если получили меньше, чем лимит, значит данных больше нет
                if (orders.length < LIMIT) {
                    setHasMore(false);
                }
            } else {
                if (append) {
                    setPastOrders((prev) => [...prev, ...pastOrdersList]);
                } else {
                    setPastOrders(pastOrdersList);
                    setPastCount(pastOrdersList.length);
                }
                // Если получили меньше, чем лимит, значит данных больше нет
                if (orders.length < LIMIT) {
                    setHasMore(false);
                }
            }

            setError(null);
        } catch (err) {
            console.error("Failed to load orders:", err);
            setError("Не удалось загрузить заказы");
        } finally {
            if (append) {
                setLoadingMore(false);
            } else {
                setLoading(false);
            }
        }
    };

    const loadMoreOrders = useCallback(() => {
        if (loadingMore || !hasMore) return;

        if (tabValue === 0) {
            // Загрузка активных заказов
            const nextSkip = activeSkip + LIMIT;
            activeSkipRef.current = nextSkip;
            loadOrders(nextSkip, "active", true);
        } else {
            // Загрузка прошедших заказов
            const nextSkip = pastSkip + LIMIT;
            pastSkipRef.current = nextSkip;
            loadOrders(nextSkip, "past", true);
        }
    }, [tabValue, loadingMore, hasMore, activeSkip, pastSkip]);

    // Наблюдатель для бесконечной прокрутки
    const lastOrderElementRef = useCallback(
        (node) => {
            if (loadingMore || !hasMore) return;
            if (observer.current) observer.current.disconnect();

            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    loadMoreOrders();
                }
            });

            if (node) observer.current.observe(node);
        },
        [loadMoreOrders]
    );

    // Добавьте ЭТОТ useEffect для первоначальной загрузки только активных заказов
    useEffect(() => {
        // Загружаем активные заказы при монтировании компонента
        loadOrders(0, "active", false);
         loadOrders(0, "past", false);
    }, []); // Пустой массив = выполнится только один раз при монтировании

    useEffect(() => {
        // Сбрасываем пропуски при смене вкладки и загружаем заказы
        if (tabValue === 0) {
            if (activeOrders.length === 0) {
                // Если активные заказы еще не были загружены, загрузим их
                activeSkipRef.current = 0;
                setActiveOrders([]);
                setHasMore(true); // Сбрасываем флаг, чтобы можно было загружать больше
                loadOrders(0, "active", false);
            } else {
                // Если уже загружены, обновляем только пропуск
                activeSkipRef.current = 0;
            }
        } else {
            if (pastOrders.length === 0) {
                // Если прошедшие заказы еще не были загружены, загрузим их
                pastSkipRef.current = 0;
                setPastOrders([]);
                setHasMore(true); // Сбрасываем флаг, чтобы можно было загружать больше
                loadOrders(0, "past", false);
            } else {
                // Если уже загружены, обновляем только пропуск
                pastSkipRef.current = 0;
            }
        }
    }, [tabValue]);

    const handleOrderClick = async (order) => {
        setSelectedOrder(order);
        setLoadingDetails(true);
        // We'll use the payment details API only when the modal opens, to ensure we have the most up-to-date details
        try {
            const details = await paymentsAPI.getPaymentDetails(order.id);
            setOrderDetails(details);
        } catch (err) {
            console.error("Failed to load order details:", err);
            // If payment details API fails, use the basic order data that we have
            setOrderDetails({
                ...order,
                tickets: order.tickets || [],
                concession_preorders: order.concession_preorders || [],
            });
        } finally {
            setLoadingDetails(false);
        }
    };

    const handlePayForOrder = async (orderId) => {
        try {
            // Redirect to payment page for this order
            window.location.href = `/payment/${orderId}`;
        } catch (err) {
            console.error("Failed to redirect to payment:", err);
            setError("Не удалось перейти к оплате заказа");
        }
    };

    const displayOrders = tabValue === 0 ? activeOrders : pastOrders;

    const getStatusColor = (status) => {
        switch (status) {
            case "paid":
                return "#46d369";
            case "pending_payment":
                return "#ffd700";
            case "cancelled":
                return "#e50914";
            case "used":
                return "#666";
            default:
                return "#999";
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'paid':
                return 'Оплачен';
            case 'pending_payment':
                return 'Ожидает оплаты';
            case 'cancelled':
                return 'Отменён';
            case 'used':
                return 'Использован';
            case 'completed':
                return 'Завершён';
            default:
                return status;
        }
    };

    if (loading && displayOrders.length === 0) {
        return <Loading message="Загрузка заказов..." />;
    }

    return (
        <Container
            maxWidth="lg"
            sx={{ py: 6 }}
        >
            <Typography
                variant="h4"
                sx={{
                    fontWeight: 700,
                    mb: 4,
                    background:
                        "linear-gradient(135deg, #e50914 0%, #ffd700 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                }}
            >
                Мои заказы
            </Typography>

            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 3 }}
                >
                    {error}
                </Alert>
            )}

            {/* Табы */}
            <Paper
                sx={{
                    mb: 4,
                    background:
                        "linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)",
                    border: "1px solid rgba(229, 9, 20, 0.2)",
                }}
            >
                <Tabs
                    value={tabValue}
                    onChange={(e, newValue) => setTabValue(newValue)}
                    textColor="inherit"
                    TabIndicatorProps={{
                        style: {
                            backgroundColor: "#e50914",
                            height: 3,
                        },
                    }}
                    sx={{
                        "& .MuiTab-root": {
                            fontWeight: 600,
                            fontSize: "1rem",
                            "&.Mui-selected": {
                                color: "#e50914",
                            },
                        },
                    }}
                >
                    <Tab
                        icon={<ScheduleIcon />}
                        iconPosition="start"
                        label={`Активные (${activeCount})`}
                    />
                    <Tab
                        icon={<CheckIcon />}
                        iconPosition="start"
                        label={`Прошедшие (${pastCount})`}
                    />
                </Tabs>
            </Paper>

            {/* Список заказов */}
            {displayOrders.length > 0 ? (
                <Grid
                    container
                    spacing={3}
                >
                    {displayOrders.map((order, index) => {
                        // Устанавливаем ref для последнего элемента для бесконечной прокрутки
                        if (index === displayOrders.length - 1) {
                            return (
                                <Grid
                                    ref={lastOrderElementRef}
                                    item
                                    xs={12}
                                    key={order.id}
                                >
                                    <OrderCard
                                        order={order}
                                        onClick={() => handleOrderClick(order)}
                                        formatDate={formatDate}
                                        getStatusColor={getStatusColor}
                                        getStatusText={getStatusText} 
                                        onPay={handlePayForOrder}
                                    />
                                </Grid>
                            );
                        }
                        return (
                            <Grid
                                item
                                xs={12}
                                key={order.id}
                            >
                                <OrderCard
                                    order={order}
                                    onClick={() => handleOrderClick(order)}
                                    formatDate={formatDate}
                                    getStatusColor={getStatusColor}
                                    getStatusText={getStatusText}
                                    onPay={handlePayForOrder}
                                />
                            </Grid>
                        );
                    })}

                    {loadingMore && (
                        <Grid
                            item
                            xs={12}
                            sx={{
                                display: "flex",
                                justifyContent: "center",
                                py: 3,
                            }}
                        >
                            <CircularProgress />
                        </Grid>
                    )}
                </Grid>
            ) : (
                <Paper
                    sx={{
                        p: 6,
                        textAlign: "center",
                        background: "rgba(31, 31, 31, 0.5)",
                        border: "1px solid rgba(229, 9, 20, 0.2)",
                    }}
                >
                    <TicketIcon
                        sx={{ fontSize: 80, color: "#404040", mb: 2 }}
                    />
                    <Typography
                        variant="h6"
                        color="text.secondary"
                    >
                        {tabValue === 0
                            ? "У вас пока нет активных заказов"
                            : "Нет прошедших заказов"}
                    </Typography>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 1 }}
                    >
                        {tabValue === 0
                            ? "Создайте заказ на покупку билетов или товаров из кинобара"
                            : "История заказов пуста"}
                    </Typography>
                </Paper>
            )}

            {/* Модальное окно с деталями заказа */}
            <OrderDetailsModal
                open={!!selectedOrder}
                order={selectedOrder}
                orderDetails={orderDetails}
                loading={loadingDetails}
                onClose={() => {
                    setSelectedOrder(null);
                    setOrderDetails(null);
                }}
                onPay={handlePayForOrder}
            />
        </Container>
    );
};

const OrderCard = ({ order, onClick, formatDate, getStatusColor, getStatusText, onPay }) => {
    const isPast = order.status === "cancelled" || order.status === "used";

    return (
        <Card
            sx={{
                background: "linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)",
                border: `2px solid ${isPast ? "rgba(179, 179, 179, 0.3)" : "rgba(46, 211, 105, 0.3)"}`,
                transition: "all 0.3s ease",
                "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
                    cursor: "pointer",
                },
            }}
            onClick={onClick}
        >
            <CardContent sx={{ p: 3 }}>
                <Grid
                    container
                    spacing={3}
                >
                    {/* Левая часть - информация о заказе */}
                    <Grid
                        item
                        xs={12}
                        md={8}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 2,
                                mb: 2,
                            }}
                        >
                            <ReceiptIcon
                                sx={{ fontSize: 32, color: "#e50914" }}
                            />
                            <Box>
                                <Typography
                                    variant="h6"
                                    sx={{ fontWeight: 700 }}
                                >
                                    Заказ #{order.order_number}
                                </Typography>
                                <Chip
                                    label={getStatusText(order.status)} 
                                    size="small"
                                    sx={{
                                        mt: 0.5,
                                        background: `rgba(${parseInt(getStatusColor(order.status).slice(1, 3), 16)}, ${parseInt(getStatusColor(order.status).slice(3, 5), 16)}, ${parseInt(getStatusColor(order.status).slice(5, 7), 16)}, 0.2)`,
                                        color: getStatusColor(order.status),
                                        fontWeight: 600,
                                    }}
                                />
                            </Box>
                        </Box>

                        <Divider
                            sx={{ my: 2, borderColor: "rgba(229, 9, 20, 0.2)" }}
                        />

                        <Grid
                            container
                            spacing={2}
                        >
                            <Grid
                                item
                                xs={12}
                                sm={6}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        mb: 1,
                                    }}
                                >
                                    <TimeIcon
                                        sx={{ color: "#ffd700", fontSize: 20 }}
                                    />
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        Создан
                                    </Typography>
                                </Box>
                                <Typography
                                    variant="body1"
                                    sx={{ fontWeight: 600, ml: 3.5 }}
                                >
                                    {formatDate(order.created_at)}
                                </Typography>
                            </Grid>

                            {order.payment && order.payment.card_last_four && (
                                <Grid
                                    item
                                    xs={12}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                            mb: 1,
                                        }}
                                    >
                                        <CreditCardIcon
                                            sx={{
                                                color: "#2196f3",
                                                fontSize: 20,
                                            }}
                                        />
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            Последние 4 цифры карты
                                        </Typography>
                                    </Box>
                                    <Typography
                                        variant="body1"
                                        sx={{ fontWeight: 600, ml: 3.5 }}
                                    >
                                        {`**** ${order.payment.card_last_four}`}
                                    </Typography>
                                </Grid>
                            )}
                        </Grid>

                        <Divider
                            sx={{ my: 2, borderColor: "rgba(229, 9, 20, 0.2)" }}
                        />

                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <Typography
                                variant="body2"
                                color="text.secondary"
                            >
                                Билетов: {order.tickets?.length || 0}
                            </Typography>
                            <Typography
                                variant="h6"
                                sx={{ fontWeight: 700, color: "#46d369" }}
                            >
                                {order.final_amount} ₽
                            </Typography>
                        </Box>
                    </Grid>

                    {/* Правая часть - количество билетов и товаров */}
                    <Grid
                        item
                        xs={12}
                        md={4}
                    >
                        <Paper
                            sx={{
                                p: 2,
                                background: "#2a2a2a",
                                borderRadius: 2,
                            }}
                        >
                            <Typography
                                variant="h6"
                                sx={{
                                    fontWeight: 600,
                                    mb: 1,
                                    textAlign: "center",
                                }}
                            >
                                Состав заказа
                            </Typography>
                            <Divider sx={{ my: 1 }} />
                            <Box sx={{ textAlign: "center" }}>
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        gap: 1,
                                        mb: 1,
                                    }}
                                >
                                    <TicketIcon
                                        sx={{ color: "#46d369", fontSize: 20 }}
                                    />
                                    <Typography variant="body1">
                                        Билеты: {order.tickets?.length || 0}
                                    </Typography>
                                </Box>
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <ConcessionIcon
                                        sx={{ color: "#ffd700", fontSize: 20 }}
                                    />
                                    <Typography variant="body1">
                                        Товары:{" "}
                                        {
                                            (order.concession_preorders || [])
                                                .length
                                        }
                                    </Typography>
                                </Box>
                            </Box>
                        </Paper>

                        {order.status !== "paid" &&
                            order.status !== "used" &&
                            order.status !== "cancelled" && (
                                <Button
                                    variant="contained"
                                    fullWidth
                                    sx={{
                                        mt: 2,
                                        py: 1,
                                        background:
                                            "linear-gradient(135deg, #e50914 0%, #b00710 100%)",
                                        "&:hover": {
                                            background:
                                                "linear-gradient(135deg, #ff1a1a 0%, #cc0812 100%)",
                                        },
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onPay(order.id);
                                    }}
                                >
                                    Оплатить заказ
                                </Button>
                            )}
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
};

const OrderDetailsModal = ({
    open,
    order,
    orderDetails,
    loading,
    onClose,
    onPay,
}) => {
    const formatDate = (dateString) => {
        try {
            return format(parseISO(dateString), "d MMMM yyyy, HH:mm", {
                locale: ru,
            });
        } catch {
            return dateString;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case "paid":
                return "#46d369";
            case "pending_payment":
                return "#ffd700";
            case "cancelled":
                return "#e50914";
            case "used":
                return "#666";
            default:
                return "#999";
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'paid':
                return 'Оплачен';
            case 'pending_payment':
                return 'Ожидает оплаты';
            case 'cancelled':
                return 'Отменён';
            case 'used':
                return 'Использован';
            case 'completed':
                return 'Завершён';
            default:
                return status;
        }
    };

    if (loading) {
        return (
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Детали заказа</DialogTitle>
                <DialogContent>
                    <Box
                        sx={{ display: "flex", justifyContent: "center", p: 4 }}
                    >
                        <CircularProgress />
                    </Box>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background:
                        "linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)",
                    color: "white",
                }}
            >
                <span>Детали заказа #{order?.order_number}</span>
                <IconButton
                    onClick={onClose}
                    sx={{ color: "white" }}
                >
                    <ArrowBackIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                {order && orderDetails ? (
                    <Box sx={{ py: 2 }}>
                        <Grid
                            container
                            spacing={2}
                        >
                            <Grid
                                item
                                xs={12}
                            >
                                <Paper
                                    sx={{ p: 2, mb: 2}}
                                >
                                    <Typography
                                        variant="h6"
                                        sx={{ fontWeight: 600, mb: 1 }}
                                    >
                                        Общая информация
                                    </Typography>
                                    <Grid
                                        container
                                        spacing={1}
                                    >
                                        <Grid
                                            item
                                            xs={6}
                                        >
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                Статус
                                            </Typography>
                                            <Typography
                                                sx={{
                                                    fontWeight: 600,
                                                    color: getStatusColor(
                                                        order.status
                                                    ),
                                                }}
                                            >
                                                {order.status}
                                            </Typography>
                                        </Grid>
                                        <Grid
                                            item
                                            xs={6}
                                        >
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                Дата создания
                                            </Typography>
                                            <Typography
                                                sx={{ fontWeight: 600 }}
                                            >
                                                {formatDate(order.created_at)}
                                            </Typography>
                                        </Grid>
                                        <Grid
                                            item
                                            xs={6}
                                        >
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                Номер заказа
                                            </Typography>
                                            <Typography
                                                sx={{ fontWeight: 600 }}
                                            >
                                                #{order.order_number}
                                            </Typography>
                                        </Grid>
                                        <Grid
                                            item
                                            xs={6}
                                        >
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                Сумма заказа
                                            </Typography>
                                            <Typography
                                                sx={{
                                                    fontWeight: 600,
                                                    color: "#46d369",
                                                }}
                                            >
                                                {order.final_amount} ₽
                                            </Typography>
                                        </Grid>
                                        {orderDetails.promocode_id && (
                                            <Grid
                                                item
                                                xs={12}
                                            >
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    Примененный промокод
                                                </Typography>
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 1,
                                                    }}
                                                >
                                                    <LocalOfferIcon
                                                        sx={{
                                                            color: "#ffd700",
                                                            fontSize: 20,
                                                        }}
                                                    />
                                                    <Typography
                                                        sx={{ fontWeight: 600 }}
                                                    >
                                                        Промокод применен
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                        )}
                                        {orderDetails.payment &&
                                            orderDetails.payment
                                                .card_last_four && (
                                                <Grid
                                                    item
                                                    xs={12}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        Последние 4 цифры карты
                                                    </Typography>
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 1,
                                                        }}
                                                    >
                                                        <CreditCardIcon
                                                            sx={{
                                                                color: "#2196f3",
                                                                fontSize: 20,
                                                            }}
                                                        />
                                                        <Typography
                                                            sx={{
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            ****{" "}
                                                            {
                                                                orderDetails
                                                                    .payment
                                                                    .card_last_four
                                                            }
                                                        </Typography>
                                                    </Box>
                                                </Grid>
                                            )}
                                    </Grid>
                                </Paper>
                            </Grid>

                            {/* Билеты */}
                            <Grid
                                item
                                xs={12}
                            >
                                <Accordion>
                                    <AccordionSummary
                                        expandIcon={<ExpandMoreIcon />}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                            }}
                                        >
                                            <TicketIcon
                                                sx={{ color: "#46d369" }}
                                            />
                                            <Typography>
                                                Билеты (
                                                {orderDetails.tickets?.length ||
                                                    0}
                                                )
                                            </Typography>
                                        </Box>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <List>
                                            {orderDetails.tickets?.map(
                                                (ticket) => (
                                                    <ListItem
                                                        key={ticket.id}
                                                        divider
                                                    >
                                                        <ListItemIcon>
                                                            <TicketIcon
                                                                sx={{
                                                                    color: "#46d369",
                                                                }}
                                                            />
                                                        </ListItemIcon>
                                                        <ListItemText
                                                            primary={`${ticket.session?.film?.title || "Фильм"} - Ряд ${ticket.seat?.row_number}, Место ${ticket.seat?.seat_number}`}
                                                            secondary={`Цена: ${ticket.price} ₽ | Статус: ${ticket.status}`}
                                                        />
                                                    </ListItem>
                                                )
                                            )}
                                        </List>
                                    </AccordionDetails>
                                </Accordion>
                            </Grid>

                            {/* Товары из кинобара */}
                            {orderDetails.concession_preorders &&
                                orderDetails.concession_preorders.length >
                                    0 && (
                                    <Grid
                                        item
                                        xs={12}
                                    >
                                        <Accordion>
                                            <AccordionSummary
                                                expandIcon={<ExpandMoreIcon />}
                                            >
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 1,
                                                    }}
                                                >
                                                    <ConcessionIcon
                                                        sx={{
                                                            color: "#ffd700",
                                                        }}
                                                    />
                                                    <Typography>
                                                        Товары из кинобара (
                                                        {orderDetails
                                                            .concession_preorders
                                                            ?.length || 0}
                                                        )
                                                    </Typography>
                                                </Box>
                                            </AccordionSummary>
                                            <AccordionDetails>
                                                <List>
                                                    {orderDetails.concession_preorders?.map(
                                                        (preorder) => (
                                                            <ListItem
                                                                key={
                                                                    preorder.id
                                                                }
                                                                divider
                                                            >
                                                                <ListItemIcon>
                                                                    <ConcessionIcon
                                                                        sx={{
                                                                            color: "#ffd700",
                                                                        }}
                                                                    />
                                                                </ListItemIcon>
                                                                <ListItemText
                                                                    primary={`${preorder.concession_item?.name || "Товар"} - ${preorder.quantity} шт.`}
                                                                    secondary={`Цена: ${preorder.total_price} ₽ | Статус: ${preorder.status} | Код получения: ${preorder.pickup_code}`}
                                                                />
                                                            </ListItem>
                                                        )
                                                    )}
                                                </List>
                                            </AccordionDetails>
                                        </Accordion>
                                    </Grid>
                                )}

                            {/* QR-код */}
                            {orderDetails && orderDetails.qr_code && (
                                <Grid
                                    item
                                    xs={12}
                                >
                                    <Paper sx={{ p: 2, textAlign: "center" }}>
                                        <QrCodeIcon
                                            sx={{
                                                fontSize: 80,
                                                color: "#141414",
                                            }}
                                        />
                                        <Typography
                                            variant="body2"
                                            sx={{ mt: 1 }}
                                        >
                                            QR-код заказа
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            sx={{ color: "#666" }}
                                        >
                                            {orderDetails.qr_code}
                                        </Typography>
                                    </Paper>
                                </Grid>
                            )}

                            {/* Кнопка оплаты */}
                            {order.status !== "paid" &&
                                order.status !== "used" &&
                                order.status !== "cancelled" && (
                                    <Grid
                                        item
                                        xs={12}
                                    >
                                        <Button
                                            variant="contained"
                                            fullWidth
                                            size="large"
                                            sx={{
                                                py: 1.5,
                                                fontSize: "1.1rem",
                                                fontWeight: 600,
                                                background:
                                                    "linear-gradient(135deg, #e50914 0%, #b00710 100%)",
                                                "&:hover": {
                                                    background:
                                                        "linear-gradient(135deg, #ff1a1a 0%, #cc0812 100%)",
                                                },
                                            }}
                                            onClick={() => onPay(order.id)}
                                        >
                                            Перейти к оплате (
                                            {order.final_amount} ₽)
                                        </Button>
                                    </Grid>
                                )}
                        </Grid>
                    </Box>
                ) : (
                    <Typography>Не удалось загрузить детали заказа</Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Закрыть</Button>
            </DialogActions>
        </Dialog>
    );
};

export default MyOrders;

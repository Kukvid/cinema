import React, { useState, useEffect } from "react";
import {
    Container,
    Typography,
    Box,
    Paper,
    Button,
    TextField,
    Alert,
    Grid,
    Card,
    CardContent,
    Chip,
    Divider,
    CircularProgress,
    Stepper,
    Step,
    StepLabel,
} from "@mui/material";
import {
    Payment as PaymentIcon,
    CreditCard as CreditCardIcon,
    CheckCircle as CheckIcon,
    Info as InfoIcon,
} from "@mui/icons-material";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { bookingsAPI } from "../api/bookings";
import { paymentsAPI } from "../api/payments";
import Loading from "../components/Loading";

const PaymentPage = () => {
    const { id: orderId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [error, setError] = useState(null);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    
    // Данные формы оплаты
    const [paymentData, setPaymentData] = useState({
        card_number: "",
        expiry_date: "",
        cvv: "",
        cardholder_name: "",
        amount: 0,
        payment_method: "card",
    });

    useEffect(() => {
        loadOrderDetails();
    }, [orderId]);

    const loadOrderDetails = async () => {
        try {
            setLoading(true);
            const orderDetails = await paymentsAPI.getPaymentDetails(orderId);
            setOrder(orderDetails);
            
            // Устанавливаем сумму к оплате
            setPaymentData(prev => ({
                ...prev,
                amount: orderDetails.final_amount
            }));
            
            setError(null);
        } catch (err) {
            console.error("Failed to load order details:", err);
            setError("Не удалось загрузить детали заказа");
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setPaymentData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const validateCardNumber = (number) => {
        const cleanNumber = number.replace(/\s/g, '');

        // Проверяем специальные тестовые карты
        if (cleanNumber === "9999888877776666" || cleanNumber === "5555444433332222") {
            return true; // Специальные карты всегда проходят валидацию
        }

        // Простая валидация обычного номера карты (16 цифр)
        return /^\d{16}$/.test(cleanNumber);
    };

    const validateExpiryDate = (date) => {
        // Проверяем формат MM/YY
        if (!/^\d{2}\/\d{2}$/.test(date)) return false;
        const [month, year] = date.split('/').map(Number);
        const currentYear = new Date().getFullYear() % 100;
        const currentMonth = new Date().getMonth() + 1;
        
        if (year < currentYear) return false;
        if (year === currentYear && month < currentMonth) return false;
        if (month < 1 || month > 12) return false;
        
        return true;
    };

    const validateCvv = (cvv) => {
        return /^\d{3,4}$/.test(cvv);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Валидация данных карты
        if (!validateCardNumber(paymentData.card_number)) {
            setError("Неверный номер карты. Должно быть 16 цифр.");
            return;
        }
        
        if (!validateExpiryDate(paymentData.expiry_date)) {
            setError("Неверная дата окончания. Используйте формат ММ/ГГ.");
            return;
        }
        
        if (!validateCvv(paymentData.cvv)) {
            setError("Неверный CVV. Должно быть 3-4 цифры.");
            return;
        }
        
        // if (!paymentData.cardholder_name.trim()) {
        //     setError("Укажите имя держателя карты.");
        //     return;
        // }

        try {
            setPaymentLoading(true);
            setError(null);
            
            // Подготовка данных для оплаты
            const paymentPayload = {
                amount: order?.final_amount,
                payment_method: "card",
                card_number: paymentData.card_number,
                card_expiry: paymentData.expiry_date,
                card_cvv: paymentData.cvv,
            };
            
            const result = await paymentsAPI.processPayment(orderId, paymentPayload);
            
            if (result.status === "paid") {
                setPaymentSuccess(true);
                // Немедленно перенаправляем на страницу билетов (без задержки или с короткой задержкой)
                setTimeout(() => {
                    navigate("/my-tickets"); // Перенаправление на страницу моих билетов
                }, 1500); // Сокращаем задержку для лучшего UX
            } else {
                setError(result.message || "Ошибка при обработке платежа");
            }
        } catch (err) {
            console.error("Payment failed:", err);
            setError(err.response?.data?.detail || "Ошибка при обработке платежа");
        } finally {
            setPaymentLoading(false);
        }
    };

    if (loading) {
        return <Loading message="Загрузка информации о заказе..." />;
    }

    if (error && !order) {
        return (
            <Container sx={{ py: 4 }}>
                <Alert severity="error">{error}</Alert>
            </Container>
        );
    }

    if (paymentSuccess) {
        return (
            <Container maxWidth="sm" sx={{ py: 6, textAlign: 'center' }}>
                <Paper 
                    sx={{ 
                        p: 4, 
                        background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
                        border: '2px solid rgba(70, 211, 105, 0.3)',
                    }}
                >
                    <CheckIcon sx={{ fontSize: 80, color: '#46d369', mb: 2 }} />
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 2, color: '#46d369' }}>
                        Оплата прошла успешно!
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
                        Ваш заказ #{order?.order_number} оплачен. Билеты доступны в разделе "Мои билеты".
                    </Typography>
                    <CircularProgress />
                    <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                        Перенаправление через несколько секунд...
                    </Typography>
                </Paper>
            </Container>
        );
    }

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Typography
                variant="h4"
                sx={{
                    fontWeight: 700,
                    mb: 4,
                    background: "linear-gradient(135deg, #e50914 0%, #ffd700 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                }}
            >
                Оплата заказа
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            <Grid container spacing={4}>
                {/* Информация о заказе */}
                <Grid item xs={12} md={6}>
                    <Paper
                        sx={{
                            p: 3,
                            background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
                            border: '1px solid rgba(229, 9, 20, 0.2)',
                        }}
                    >
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center' }}>
                            <InfoIcon sx={{ mr: 1, color: '#ffd700' }} />
                            Информация о заказе
                        </Typography>
                        
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">Номер заказа</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {order?.order_number}
                            </Typography>
                        </Box>
                        
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">Дата создания</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {order?.created_at ? new Date(order.created_at).toLocaleString('ru-RU') : 'N/A'}
                            </Typography>
                        </Box>
                        
                        <Divider sx={{ my: 2 }} />
                        
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Состав заказа</Typography>

                        {/* Билеты */}
                        {order?.tickets?.map((ticket, index) => (
                            <Box key={ticket.id} sx={{ mb: 1, pl: 2 }}>
                                <Typography variant="body2">
                                    Билет #{index + 1}: {ticket.session?.film?.title || 'Фильм'} -
                                    Ряд {ticket.seat?.row_number}, Место {ticket.seat?.seat_number}
                                </Typography>
                            </Box>
                        ))}

                        {/* Товары из кинобара */}
                        {order?.concession_preorders?.map((preorder, index) => (
                            <Box key={preorder.id} sx={{ mb: 1, pl: 2 }}>
                                <Typography variant="body2">
                                    Товар #{index + 1}: {preorder.concession_item?.name || 'Неизвестный товар'} -
                                    {preorder.quantity} шт. × {preorder.unit_price.toFixed(2)} ₽
                                </Typography>
                            </Box>
                        ))}

                        {!order?.tickets?.length && !order?.concession_preorders?.length && "Пустой заказ"}

                        <Divider sx={{ my: 2 }} />

                        <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body1">Сумма заказа:</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {order?.total_amount.toFixed(2)} ₽
                            </Typography>
                        </Box>

                        <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2" color="text.secondary">Скидка:</Typography>
                            <Typography variant="body2" color="text.secondary">
                                -{order?.discount_amount.toFixed(2)} ₽
                            </Typography>
                        </Box>

                        <Divider sx={{ my: 1 }} />

                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="h6">Итого:</Typography>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: '#46d369' }}>
                                {order?.final_amount.toFixed(2)} ₽
                            </Typography>
                        </Box>
                    </Paper>
                </Grid>

                {/* Форма оплаты */}
                <Grid item xs={12} md={6}>
                    <Paper
                        sx={{
                            p: 3,
                            background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
                            border: '1px solid rgba(229, 9, 20, 0.2)',
                        }}
                    >
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, display: 'flex', alignItems: 'center' }}>
                            <CreditCardIcon sx={{ mr: 1, color: '#e50914' }} />
                            Данные карты
                        </Typography>
                        
                        <form onSubmit={handleSubmit}>
                            <TextField
                                fullWidth
                                label="Номер карты"
                                name="card_number"
                                value={paymentData.card_number}
                                onChange={handleInputChange}
                                placeholder="0000 0000 0000 0000"
                                inputProps={{ maxLength: 19 }}
                                sx={{ mb: 2 }}
                                InputProps={{
                                    sx: {
                                        background: '#2a2a2a',
                                        '& input': {
                                            letterSpacing: '1px'
                                        }
                                    },
                                    // endAdornment: (
                                    //     <Button
                                    //         size="small"
                                    //         onClick={() => setPaymentData(prev => ({...prev, card_number: "9999 8888 7777 6666"}))}
                                    //         sx={{ color: '#46d369', minWidth: 'auto', fontSize: '0.7rem' }}
                                    //         title="Карта с бесконечным балансом"
                                    //     >
                                    //         ∞
                                    //     </Button>
                                    // )
                                }}
                            />
                            {/* <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                                Специальные тестовые карты:
                                9999 8888 7777 6666 (бесконечный баланс),
                                5555 4444 3333 2222 (только для заказов на 1500 ₽)
                            </Typography> */}
                            
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <TextField
                                        fullWidth
                                        label="Срок действия"
                                        name="expiry_date"
                                        value={paymentData.expiry_date}
                                        onChange={handleInputChange}
                                        placeholder="ММ/ГГ"
                                        inputProps={{ maxLength: 5 }}
                                        sx={{ mb: 2 }}
                                        InputProps={{
                                            sx: { background: '#2a2a2a' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        fullWidth
                                        label="CVV"
                                        name="cvv"
                                        value={paymentData.cvv}
                                        onChange={handleInputChange}
                                        placeholder="123"
                                        inputProps={{ maxLength: 4 }}
                                        sx={{ mb: 2 }}
                                        InputProps={{
                                            sx: { background: '#2a2a2a' }
                                        }}
                                    />
                                </Grid>
                            </Grid>
                            
                            <TextField
                                fullWidth
                                label="Имя держателя карты"
                                name="cardholder_name"
                                value={paymentData.cardholder_name}
                                onChange={handleInputChange}
                                placeholder="Иван Иванов"
                                sx={{ mb: 3 }}
                                InputProps={{
                                    sx: { background: '#2a2a2a' }
                                }}
                            />
                            
                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                size="large"
                                startIcon={<PaymentIcon />}
                                disabled={paymentLoading}
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
                            >
                                {paymentLoading ? (
                                    <>
                                        <CircularProgress size={20} sx={{ mr: 1 }} />
                                        Обработка платежа...
                                    </>
                                ) : (
                                    `Оплатить ${order?.final_amount.toFixed(2)} ₽`
                                )}
                            </Button>
                        </form>
                    </Paper>
                    
                    {/* Информация о безопасности */}
                    <Paper
                        sx={{
                            p: 2,
                            mt: 2,
                            background: 'rgba(30, 30, 30, 0.7)',
                            border: '1px solid rgba(70, 211, 105, 0.2)',
                        }}
                    >
                        <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                            <CheckIcon sx={{ fontSize: 16, mr: 1, color: '#46d369' }} />
                            Все данные передаются по защищенному соединению
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>
        </Container>
    );
};

export default PaymentPage;
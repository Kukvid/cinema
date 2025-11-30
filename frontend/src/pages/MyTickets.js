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
} from "@mui/material";
import {
    ConfirmationNumber as TicketIcon,
    EventSeat as SeatIcon,
    AccessTime as TimeIcon,
    Place as PlaceIcon,
    QrCode as QrCodeIcon,
    CheckCircle as CheckIcon,
    Schedule as ScheduleIcon,
} from "@mui/icons-material";
import { format, parseISO, isPast } from "date-fns";
import { ru } from "date-fns/locale";
import Loading from "../components/Loading";
import { ticketsAPI } from "../api/tickets";

const MyTickets = () => {
    const [activeTickets, setActiveTickets] = useState([]);
    const [pastTickets, setPastTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [tabValue, setTabValue] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [activeCount, setActiveCount] = useState(0);
    const [pastCount, setPastCount] = useState(0);
    
    // Для бесконечной прокрутки
    const activePageRef = useRef(0);
    const pastPageRef = useRef(0);
    const observer = useRef();
    
    const LIMIT = 10;

    const { current: activePage } = activePageRef;
    const { current: pastPage } = pastPageRef;

    const formatDate = (dateString) => {
        try {
            return format(parseISO(dateString), "d MMMM yyyy, HH:mm", {
                locale: ru,
            });
        } catch {
            return dateString;
        }
    };

    const isTicketPast = (dateString) => {
        try {
            return isPast(parseISO(dateString));
        } catch {
            return false;
        }
    };

    const loadTickets = async (page = 0, type = 'active', append = false) => {
        if (loadingMore && append) return;
        
        try {
            if (!append) {
                setLoading(type === 'active' ? !activeTickets.length : !pastTickets.length);
            } else {
                setLoadingMore(true);
            }

            const skip = page * LIMIT;
            let ticketsData;

            if (type === 'active') {
                // Загружаем только активные билеты (оплаченные, но еще не использованные)
                ticketsData = await ticketsAPI.getMyTickets(skip, LIMIT, 'paid');
            } else {
                // Загружаем прошедшие билеты (использованные)
                ticketsData = await ticketsAPI.getMyTickets(skip, LIMIT, 'used');
            }

            if (type === 'active') {
                if (append) {
                    setActiveTickets(prev => [...prev, ...ticketsData]);
                } else {
                    setActiveTickets(ticketsData);
                }
            } else {
                if (append) {
                    setPastTickets(prev => [...prev, ...ticketsData]);
                } else {
                    setPastTickets(ticketsData);
                }
            }

            setError(null);
        } catch (err) {
            console.error("Failed to load tickets:", err);
            setError("Не удалось загрузить билеты");
        } finally {
            if (append) {
                setLoadingMore(false);
            } else {
                setLoading(false);
            }
        }
    };

    const loadMoreTickets = useCallback(() => {
        if (loadingMore) return;
        
        if (tabValue === 0) {
            // Загрузка активных билетов
            const nextPage = activePage + 1;
            activePageRef.current = nextPage;
            loadTickets(nextPage, 'active', true);
        } else {
            // Загрузка прошедших билетов
            const nextPage = pastPage + 1;
            pastPageRef.current = nextPage;
            loadTickets(nextPage, 'past', true);
        }
    }, [tabValue, loadingMore, activePage, pastPage]);

    // Наблюдатель для бесконечной прокрутки
    const lastTicketElementRef = useCallback(node => {
        if (loadingMore || !hasMore) return;
        if (observer.current) observer.current.disconnect();
        
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                loadMoreTickets();
            }
        });

        if (node) observer.current.observe(node);
    }, [loadMoreTickets]);

    useEffect(() => {
        // Загружаем счетчики билетов
        const loadCounts = async () => {
            try {
                const activeCount = await ticketsAPI.getMyTicketsCount('paid');
                const pastCount = await ticketsAPI.getMyTicketsCount('used');
                
                setActiveCount(activeCount);
                setPastCount(pastCount);
            } catch (err) {
                console.error("Failed to load ticket counts:", err);
            }
        };
        
        loadCounts();
    }, []);

    useEffect(() => {
        // Сбрасываем страницы при смене вкладки и загружаем билеты
        if (tabValue === 0) {
            activePageRef.current = 0;
            setActiveTickets([]);
            loadTickets(0, 'active', false);
        } else {
            pastPageRef.current = 0;
            setPastTickets([]);
            loadTickets(0, 'past', false);
        }
    }, [tabValue]);

    const displayTickets = tabValue === 0 ? activeTickets : pastTickets;

    if (loading && displayTickets.length === 0) {
        return <Loading message="Загрузка билетов..." />;
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
                Мои билеты
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

            {/* Список билетов */}
            {displayTickets.length > 0 ? (
                <Grid
                    container
                    spacing={3}
                >
                    {displayTickets.map((ticket, index) => {
                        // Устанавливаем ref для последнего элемента для бесконечной прокрутки
                        if (index === displayTickets.length - 1) {
                            return (
                                <Grid
                                    ref={lastTicketElementRef}
                                    item
                                    xs={12}
                                    key={ticket.id}
                                >
                                    <TicketCard ticket={ticket} tabValue={tabValue} formatDate={formatDate} />
                                </Grid>
                            );
                        }
                        return (
                            <Grid
                                item
                                xs={12}
                                key={ticket.id}
                            >
                                <TicketCard ticket={ticket} tabValue={tabValue} formatDate={formatDate} />
                            </Grid>
                        );
                    })}
                    
                    {loadingMore && (
                        <Grid 
                            item 
                            xs={12} 
                            sx={{ 
                                display: 'flex', 
                                justifyContent: 'center', 
                                py: 3 
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
                            ? "У вас пока нет активных билетов"
                            : "Нет просмотренных фильмов"}
                    </Typography>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 1 }}
                    >
                        {tabValue === 0
                            ? "Забронируйте билеты на интересующий вас сеанс"
                            : "История просмотров пуста"}
                    </Typography>
                </Paper>
            )}
        </Container>
    );
};

// Компонент карточки билета
const TicketCard = ({ ticket, tabValue, formatDate }) => {
    return (
        <Card
            sx={{
                background:
                    "linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)",
                border: `2px solid ${tabValue === 0 ? "rgba(46, 211, 105, 0.3)" : "rgba(179, 179, 179, 0.3)"}`,
                transition: "all 0.3s ease",
                "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow:
                        "0 8px 24px rgba(0, 0, 0, 0.5)",
                },
            }}
        >
            <CardContent sx={{ p: 3 }}>
                <Grid
                    container
                    spacing={3}
                >
                    {/* Левая часть - информация о сеансе */}
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
                            <TicketIcon
                                sx={{
                                    fontSize: 32,
                                    color: "#e50914",
                                }}
                            />
                            <Box>
                                <Typography
                                    variant="h6"
                                    sx={{ fontWeight: 700 }}
                                >
                                    {ticket.session?.film
                                        ?.title || "Фильм"}
                                </Typography>
                                <Chip
                                    label={
                                        tabValue === 0
                                            ? "Активный"
                                            : "Просмотрен"
                                    }
                                    size="small"
                                    icon={
                                        tabValue === 0 ? (
                                            <ScheduleIcon />
                                        ) : (
                                            <CheckIcon />
                                        )
                                    }
                                    sx={{
                                        mt: 0.5,
                                        background:
                                            tabValue === 0
                                                ? "rgba(46, 211, 105, 0.2)"
                                                : "rgba(179, 179, 179, 0.2)",
                                        color:
                                            tabValue === 0
                                                ? "#46d369"
                                                : "#b3b3b3",
                                        fontWeight: 600,
                                    }}
                                />
                            </Box>
                        </Box>

                        <Divider
                            sx={{
                                my: 2,
                                borderColor:
                                    "rgba(229, 9, 20, 0.2)",
                            }}
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
                                        alignItems:
                                            "center",
                                        gap: 1,
                                        mb: 1,
                                    }}
                                >
                                    <TimeIcon
                                        sx={{
                                            color: "#ffd700",
                                            fontSize: 20,
                                        }}
                                    />
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        Время сеанса
                                    </Typography>
                                </Box>
                                <Typography
                                    variant="body1"
                                    sx={{
                                        fontWeight: 600,
                                        ml: 3.5,
                                    }}
                                >
                                    {formatDate(
                                        ticket.session
                                            ?.start_datetime
                                    )}
                                </Typography>
                            </Grid>

                            <Grid
                                item
                                xs={12}
                                sm={6}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems:
                                            "center",
                                        gap: 1,
                                        mb: 1,
                                    }}
                                >
                                    <PlaceIcon
                                        sx={{
                                            color: "#ffd700",
                                            fontSize: 20,
                                        }}
                                    />
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        Кинотеатр
                                    </Typography>
                                </Box>
                                <Typography
                                    variant="body1"
                                    sx={{
                                        fontWeight: 600,
                                        ml: 3.5,
                                    }}
                                >
                                    {ticket.session?.hall
                                        ?.cinema?.name ||
                                        "Кинотеатр"}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ ml: 3.5 }}
                                >
                                    Зал{" "}
                                    {ticket.session?.hall
                                        ?.name ||
                                        ticket.session
                                            ?.hall_id}
                                </Typography>
                            </Grid>

                            <Grid
                                item
                                xs={12}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems:
                                            "center",
                                        gap: 1,
                                        mb: 1,
                                    }}
                                >
                                    <SeatIcon
                                        sx={{
                                            color: "#2196f3",
                                            fontSize: 20,
                                        }}
                                    />
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        Место
                                    </Typography>
                                </Box>
                                <Box
                                    sx={{
                                        ml: 3.5,
                                    }}
                                >
                                    <Typography
                                        variant="body1"
                                        sx={{ fontWeight: 600 }}
                                    >
                                        Ряд {ticket.seat?.row_number}, Место {ticket.seat?.seat_number}
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>

                        <Divider
                            sx={{
                                my: 2,
                                borderColor:
                                    "rgba(229, 9, 20, 0.2)",
                            }}
                        />

                        <Box
                            sx={{
                                display: "flex",
                                justifyContent:
                                    "space-between",
                                alignItems: "center",
                            }}
                        >
                            <Typography
                                variant="body2"
                                color="text.secondary"
                            >
                                Билет #{ticket.id}
                            </Typography>
                            <Typography
                                variant="h6"
                                sx={{
                                    fontWeight: 700,
                                    color: "#46d369",
                                }}
                            >
                                {ticket.price} ₽
                            </Typography>
                        </Box>
                    </Grid>

                    {/* Правая часть - QR код */}
                    <Grid
                        item
                        xs={12}
                        md={4}
                    >
                        <Paper
                            sx={{
                                p: 3,
                                textAlign: "center",
                                background: "#ffffff",
                                borderRadius: 2,
                            }}
                        >
                            <QrCodeIcon
                                sx={{
                                    fontSize: 120,
                                    color: "#141414",
                                }}
                            />
                            <Typography
                                variant="body2"
                                sx={{
                                    mt: 2,
                                    color: "#141414",
                                    fontWeight: 600,
                                }}
                            >
                                QR-код билета
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{ color: "#666" }}
                            >
                                {ticket.qr_code || ticket.id}
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
};

export default MyTickets;
import React from "react";
import { Box, Typography, Grid, Paper, Chip } from "@mui/material";
import { EventSeat as SeatIcon } from "@mui/icons-material";

const SeatMap = ({ seats, selectedSeats, onSeatSelect }) => {
    const getSeatColor = (seat) => {
        if (seat.seat_type === "aisle") return "transparent";
        if (selectedSeats.includes(seat.id)) return "#2196f3"; // Синий - выбрано
        if (seat.ticket_status === "paid") return "#f44336"; // Красный - оплачено
        if (seat.ticket_status === "reserved") return "#e76118ff"; // Оранжевый - забронировано, ожидает оплаты
        if (seat.is_booked) return "#f44336"; // Красный - занято (для совместимости)
        return "#46d369"; // Зеленый - свободно (включая отмененные)
    };

    const getSeatHoverColor = (seat) => {
        if (seat.seat_type === "aisle" || seat.ticket_status === "paid" || seat.ticket_status === "reserved") return "transparent";
        if (selectedSeats.includes(seat.id)) return "#1976d2";
        return "#2e7d32";
    };

    const handleSeatClick = (seat) => {
        if (seat.seat_type === "aisle" || seat.ticket_status === "paid" || seat.ticket_status === "reserved") return;
        onSeatSelect(seat);
    };

    const getSeatIcon = (seat) => {
        if (seat.seat_type === "aisle") return null;

        const isSelected = selectedSeats.includes(seat.id);
        const isBooked = seat.is_booked;

        return (
            <Box
                sx={{
                    width: 40,
                    height: 40,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 1,
                    backgroundColor: getSeatColor(seat),
                    cursor: isBooked ? "not-allowed" : "pointer",
                    transition: "all 0.3s ease",
                    border: isSelected ? "2px solid #fff" : "none",
                    boxShadow: isSelected
                        ? "0 0 10px rgba(33, 150, 243, 0.5)"
                        : "none",
                    "&:hover": {
                        backgroundColor: getSeatHoverColor(seat),
                        transform: isBooked ? "none" : "scale(1.1)",
                        boxShadow: isBooked
                            ? "none"
                            : "0 4px 8px rgba(0,0,0,0.3)",
                    },
                }}
                onClick={() => handleSeatClick(seat)}
            >
                <SeatIcon sx={{ fontSize: 24, color: "#fff" }} />
            </Box>
        );
    };

    // Группируем места по рядам
    const rows = seats.reduce((acc, seat) => {
        if (!acc[seat.row_number]) {
            acc[seat.row_number] = [];
        }
        acc[seat.row_number].push(seat);
        return acc;
    }, {});

    // Сортируем ряды и места
    const sortedRows = Object.keys(rows).sort((a, b) => a - b);

    return (
        <Box>
            {/* Экран */}
            <Box sx={{ mb: 4, textAlign: "center" }}>
                <Paper
                    elevation={3}
                    sx={{
                        width: "80%",
                        mx: "auto",
                        py: 2,
                        background:
                            "linear-gradient(135deg, #424242 0%, #212121 100%)",
                        border: "2px solid #e50914",
                        borderRadius: 2,
                    }}
                >
                    <Typography
                        variant="h6"
                        sx={{ color: "#e50914", fontWeight: 600 }}
                    >
                        ЭКРАН
                    </Typography>
                </Paper>
            </Box>

            {/* Схема мест */}
            <Box sx={{ maxWidth: "100%", overflowX: "auto", mb: 3 }}>
                {sortedRows.map((rowNumber) => (
                    <Box
                        key={rowNumber}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            mb: 1,
                            gap: 1,
                        }}
                    >
                        {/* Номер ряда слева */}
                        <Typography
                            variant="body2"
                            sx={{
                                minWidth: 30,
                                textAlign: "right",
                                fontWeight: 600,
                                color: "#b3b3b3",
                            }}
                        >
                            {rowNumber}
                        </Typography>

                        {/* Места в ряду */}
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                            {rows[rowNumber]
                                .sort((a, b) => a.seat_number - b.seat_number)
                                .map((seat) => (
                                    <Box
                                        key={seat.id}
                                        title={`Ряд ${seat.row_number}, Место ${seat.seat_number}`}
                                    >
                                        {getSeatIcon(seat)}
                                    </Box>
                                ))}
                        </Box>

                        {/* Номер ряда справа */}
                        <Typography
                            variant="body2"
                            sx={{
                                minWidth: 30,
                                textAlign: "left",
                                fontWeight: 600,
                                color: "#b3b3b3",
                            }}
                        >
                            {rowNumber}
                        </Typography>
                    </Box>
                ))}
            </Box>

            {/* Легенда */}
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 3,
                    flexWrap: "wrap",
                    mt: 3,
                    p: 2,
                    background: "rgba(31, 31, 31, 0.5)",
                    borderRadius: 2,
                }}
            >
                <Chip
                    icon={<SeatIcon sx={{ color: "#ffffffff !important" }} />}
                    label="Свободно"
                    sx={{
                        backgroundColor: "#46d369",
                        color: "#fff",
                        fontWeight: 600,
                    }}
                />
                <Chip
                    icon={<SeatIcon sx={{ color: "#ffffffff !important" }} />}
                    label="Оплачен"
                    sx={{
                        backgroundColor: "#f44336",
                        color: "#fff",
                        fontWeight: 600,
                    }}
                />
                <Chip
                    icon={<SeatIcon sx={{ color: "#ffffffff !important" }} />}
                    label="Бронь (ожидает оплаты)"
                    sx={{
                        backgroundColor: "#e76118ff",
                        color: "#ffffffff",
                        fontWeight: 600,
                    }}
                />
                <Chip
                    icon={<SeatIcon sx={{ color: "#ffffffff !important" }} />}
                    label="Выбрано"
                    sx={{
                        backgroundColor: "#2196f3",
                        color: "#fff",
                        fontWeight: 600,
                    }}
                />
            </Box>
        </Box>
    );
};

export default SeatMap;

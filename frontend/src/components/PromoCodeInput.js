import React, { useState } from "react";
import {
    Box,
    TextField,
    Button,
    Alert,
    IconButton,
    CircularProgress,
} from "@mui/material";
import {
    LocalOffer as PromoIcon,
    Close as CloseIcon,
} from "@mui/icons-material";
import { validatePromocode } from "../api/promocodes";

const PromoCodeInput = ({ onApply, disabled = false, currentTotal = 0 }) => {
    const [promoCode, setPromoCode] = useState("");
    const [appliedPromo, setAppliedPromo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleApply = async () => {
        if (!promoCode.trim()) return;

        try {
            setLoading(true);
            setError(null);

            const promoData = await validatePromocode(promoCode, currentTotal);

            // Проверяем, действителен ли промокод
            if (promoData.is_valid) {
                setAppliedPromo(promoData);
                onApply(promoData); // Передаем только действительный промокод
            } else {
                setError(promoData.message || "Промокод недействителен");
                setAppliedPromo(null);
                onApply(null);
            }
        } catch (err) {
            console.error("Promo validation error:", err);

            if (err.response?.status === 404) {
                setError("Промокод не найден");
            } else if (err.response?.status === 400) {
                setError(
                    err.response?.data?.detail || "Промокод недействителен"
                );
            } else {
                setError("Ошибка проверки промокода");
            }

            setAppliedPromo(null);
            onApply(null);
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setPromoCode("");
        setAppliedPromo(null);
        setError(null);
        onApply(null);
    };

    const formatDiscount = (promo) => {
        if (!promo || !promo.is_valid) return "";

        return `${promo.discount_amount}₽`;
    };

    return (
        <Box sx={{ mb: 2 }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                <TextField
                    fullWidth
                    size="small"
                    label="Промокод"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    disabled={disabled || !!appliedPromo || loading}
                    error={!!error}
                    sx={{ mb: 1 }}
                    InputProps={{
                        startAdornment: (
                            <PromoIcon sx={{ mr: 1, color: "#ffd700" }} />
                        ),
                    }}
                    onKeyPress={(e) => {
                        if (e.key === "Enter" && !appliedPromo) {
                            handleApply();
                        }
                    }}
                />
                {appliedPromo && (
                    <IconButton
                        size="small"
                        onClick={handleClear}
                        sx={{
                            mt: 0.5,
                            color: "#e50914",
                            "&:hover": {
                                bgcolor: "rgba(229, 9, 20, 0.1)",
                            },
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                )}
            </Box>

            <Button
                fullWidth
                variant="outlined"
                onClick={handleApply}
                disabled={
                    disabled || !promoCode.trim() || loading || !!appliedPromo
                }
                sx={{
                    borderColor: "#ffd700",
                    color: "#ffd700",
                    "&:hover": {
                        borderColor: "#ffed4e",
                        bgcolor: "rgba(255, 215, 0, 0.1)",
                    },
                    "&.Mui-disabled": {
                        borderColor: "rgba(255, 215, 0, 0.3)",
                        color: "rgba(255, 215, 0, 0.3)",
                    },
                }}
            >
                {loading ? (
                    <>
                        <CircularProgress
                            size={20}
                            sx={{ mr: 1 }}
                        />
                        Проверка...
                    </>
                ) : appliedPromo ? (
                    "Промокод применён"
                ) : (
                    "Применить промокод"
                )}
            </Button>

            {error && (
                <Alert
                    severity="error"
                    sx={{ mt: 1 }}
                    onClose={() => setError(null)}
                >
                    {error}
                </Alert>
            )}

            {/* {appliedPromo && appliedPromo.is_valid && (
                <Alert
                    severity="success"
                    sx={{ mt: 1 }}
                >
                    Промокод применён! Скидка: {formatDiscount(appliedPromo)}
                </Alert>
            )} */}
        </Box>
    );
};

export default PromoCodeInput;

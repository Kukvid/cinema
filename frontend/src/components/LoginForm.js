import React, { useState } from "react";
import {
    TextField,
    Button,
    Alert,
    InputAdornment,
    IconButton,
    Box,
    Link,
} from "@mui/material";
import {
    Email as EmailIcon,
    Lock as LockIcon,
    Visibility,
    VisibilityOff,
} from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useForm } from "react-hook-form";

const LoginForm = ({ onLoginSuccess }) => {
    const { login } = useAuth();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm();

    const onSubmit = async (data) => {
        try {
            setLoading(true);
            setError("");

            const result = await login(data.email, data.password);

            if (result.success) {
                onLoginSuccess();
            } else {
                setError(result.error || "Неверный email или пароль");
            }
        } catch (err) {
            console.error("Ошибка при входе:", err);
            setError("Ошибка при входе в систему");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ width: '100%' }}>
            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 3 }}
                >
                    {error}
                </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
                <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    margin="normal"
                    {...register("email", {
                        required: "Email обязателен",
                        pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: "Некорректный email",
                        },
                    })}
                    error={!!errors.email}
                    helperText={errors.email?.message}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <EmailIcon sx={{ color: "#e50914" }} />
                            </InputAdornment>
                        ),
                    }}
                />

                <TextField
                    fullWidth
                    label="Пароль"
                    type={showPassword ? "text" : "password"}
                    margin="normal"
                    {...register("password", {
                        required: "Пароль обязателен",
                        minLength: {
                            value: 6,
                            message: "Минимум 6 символов",
                        },
                    })}
                    error={!!errors.password}
                    helperText={errors.password?.message}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <LockIcon sx={{ color: "#e50914" }} />
                            </InputAdornment>
                        ),
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                    edge="end"
                                >
                                    {showPassword ? (
                                        <VisibilityOff />
                                    ) : (
                                        <Visibility />
                                    )}
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />

                <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={loading}
                    sx={{
                        mt: 3,
                        mb: 2,
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
                    {loading ? "Вход..." : "Войти"}
                </Button>

                <Box sx={{ textAlign: "center", mt: 2 }}>
                    <Link
                        component={RouterLink}
                        to="/login"
                        sx={{
                            color: "#e50914",
                            fontWeight: 600,
                            textDecoration: "none",
                            "&:hover": {
                                textDecoration: "underline",
                            },
                        }}
                        onClick={() => {
                            // Переключаемся на основной экран логина для полного процесса
                            window.location.href = "/login";
                        }}
                    >
                        Перейти на страницу входа
                    </Link>
                </Box>
            </form>
        </Box>
    );
};

export default LoginForm;
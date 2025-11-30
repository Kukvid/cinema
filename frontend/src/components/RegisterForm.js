import React, { useState } from "react";
import {
    TextField,
    Button,
    Alert,
    InputAdornment,
    Box,
    Link,
} from "@mui/material";
import {
    Person as PersonIcon,
    Email as EmailIcon,
    Lock as LockIcon,
    Phone as PhoneIcon,
    Cake as CakeIcon,
} from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useForm } from "react-hook-form";

const RegisterForm = ({ onRegisterSuccess }) => {
    const { register: registerUser } = useAuth();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
        watch,
    } = useForm();

    const onSubmit = async (data) => {
        try {
            setLoading(true);
            setError("");

            // Подготовка данных для регистрации
            const userData = {
                email: data.email,
                password: data.password,
                first_name: data.first_name,
                last_name: data.last_name,
                phone: data.phone,
                birth_date: data.birth_date,
                gender: data.gender,
                city: data.city,
                marketing_consent: data.marketing_consent,
                data_processing_consent: true, // по умолчанию согласен на обработку данных
            };

            const result = await registerUser(userData);

            if (result.success) {
                onRegisterSuccess();
            } else {
                setError(result.error || "Ошибка регистрации");
            }
        } catch (err) {
            console.error("Ошибка при регистрации:", err);
            setError("Ошибка при регистрации");
        } finally {
            setLoading(false);
        }
    };

    const password = watch("password");

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
                    label="Имя"
                    margin="normal"
                    {...register("first_name", {
                        required: "Имя обязательно",
                        minLength: {
                            value: 2,
                            message: "Минимум 2 символа",
                        },
                        maxLength: {
                            value: 100,
                            message: "Максимум 100 символов",
                        },
                    })}
                    error={!!errors.first_name}
                    helperText={errors.first_name?.message}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <PersonIcon sx={{ color: "#e50914" }} />
                            </InputAdornment>
                        ),
                    }}
                />

                <TextField
                    fullWidth
                    label="Фамилия"
                    margin="normal"
                    {...register("last_name", {
                        required: "Фамилия обязательна",
                        minLength: {
                            value: 2,
                            message: "Минимум 2 символа",
                        },
                        maxLength: {
                            value: 100,
                            message: "Максимум 100 символов",
                        },
                    })}
                    error={!!errors.last_name}
                    helperText={errors.last_name?.message}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <PersonIcon sx={{ color: "#e50914" }} />
                            </InputAdornment>
                        ),
                    }}
                />

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
                    label="Телефон"
                    margin="normal"
                    {...register("phone", {
                        pattern: {
                            value: /^[\+]?[1-9][\d]{0,15}$/,
                            message: "Некорректный номер телефона",
                        },
                    })}
                    error={!!errors.phone}
                    helperText={errors.phone?.message}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <PhoneIcon sx={{ color: "#e50914" }} />
                            </InputAdornment>
                        ),
                    }}
                />

                <TextField
                    fullWidth
                    label="Дата рождения"
                    type="date"
                    margin="normal"
                    {...register("birth_date")}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <CakeIcon sx={{ color: "#e50914" }} />
                            </InputAdornment>
                        ),
                        inputProps: {
                            max: new Date().toISOString().split('T')[0], // Ограничение текущей датой
                        }
                    }}
                />

                <TextField
                    fullWidth
                    label="Город"
                    margin="normal"
                    {...register("city", {
                        maxLength: {
                            value: 100,
                            message: "Максимум 100 символов",
                        },
                    })}
                    error={!!errors.city}
                    helperText={errors.city?.message}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <PersonIcon sx={{ color: "#e50914" }} />
                            </InputAdornment>
                        ),
                    }}
                />

                <TextField
                    fullWidth
                    label="Пароль"
                    type="password"
                    margin="normal"
                    {...register("password", {
                        required: "Пароль обязателен",
                        minLength: {
                            value: 6,
                            message: "Минимум 6 символов",
                        },
                        pattern: {
                            value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                            message: "Пароль должен содержать заглавную букву, строчную и цифру",
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
                    }}
                />

                <TextField
                    fullWidth
                    label="Подтверждение пароля"
                    type="password"
                    margin="normal"
                    {...register("confirmPassword", {
                        validate: (value) =>
                            value === password || "Пароли не совпадают",
                    })}
                    error={!!errors.confirmPassword}
                    helperText={errors.confirmPassword?.message}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <LockIcon sx={{ color: "#e50914" }} />
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
                    {loading ? "Регистрация..." : "Зарегистрироваться"}
                </Button>

                <Box sx={{ textAlign: "center", mt: 2 }}>
                    <Link
                        component={RouterLink}
                        to="/register"
                        sx={{
                            color: "#e50914",
                            fontWeight: 600,
                            textDecoration: "none",
                            "&:hover": {
                                textDecoration: "underline",
                            },
                        }}
                        onClick={() => {
                            // Переключаемся на основной экран регистрации для полного процесса
                            window.location.href = "/register";
                        }}
                    >
                        Перейти на страницу регистрации
                    </Link>
                </Box>
            </form>
        </Box>
    );
};

export default RegisterForm;
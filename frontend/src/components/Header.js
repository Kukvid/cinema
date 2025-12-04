import React, { useState } from "react";
import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    IconButton,
    Menu,
    MenuItem,
    Box,
    Avatar,
    Container,
    useScrollTrigger,
} from "@mui/material";
import {
    MovieFilter as MovieIcon,
    AccountCircle,
    ConfirmationNumber as TicketIcon,
    AdminPanelSettings as AdminIcon,
    Logout as LogoutIcon,
    QrCodeScanner as QrCodeScannerIcon,
    LocalCafe as LocalCafeIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ElevationScroll = ({ children }) => {
    const trigger = useScrollTrigger({
        disableHysteresis: true,
        threshold: 0,
    });

    return React.cloneElement(children, {
        elevation: trigger ? 4 : 0,
    });
};

const Header = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated, logout } = useAuth();
    const [anchorEl, setAnchorEl] = useState(null);

    const handleMenu = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = () => {
        logout();
        handleClose();
        navigate("/");
    };

    const handleProfile = () => {
        navigate("/profile");
        handleClose();
    };


    const handleAdmin = () => {
        navigate("/admin");
        handleClose();
    };

    return (
        <ElevationScroll>
            <AppBar
                position="sticky"
                sx={{
                    background:
                        "linear-gradient(135deg, rgba(20, 20, 20, 0.98) 0%, rgba(31, 31, 31, 0.98) 100%)",
                }}
            >
                <Container maxWidth="xl">
                    <Toolbar disableGutters>
                        <MovieIcon
                            sx={{
                                display: "flex",
                                mr: 1,
                                fontSize: 32,
                                color: "#e50914",
                            }}
                        />
                        <Typography
                            variant="h5"
                            noWrap
                            component="div"
                            sx={{
                                mr: 4,
                                display: { xs: "none", sm: "flex" },
                                fontWeight: 700,
                                letterSpacing: ".1rem",
                                color: "inherit",
                                textDecoration: "none",
                                cursor: "pointer",
                                background:
                                    "linear-gradient(135deg, #e50914 0%, #ffd700 100%)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                            }}
                            onClick={() => navigate("/")}
                        >
                            CinemaBooking
                        </Typography>

                        <Box sx={{ flexGrow: 1, display: "flex", gap: 2 }}>
                            <Button
                                color="inherit"
                                onClick={() => navigate("/")}
                                sx={{
                                    "&:hover": {
                                        color: "#e50914",
                                    },
                                }}
                            >
                                Фильмы
                            </Button>
                            {isAuthenticated && (
                                <Button
                                    color="inherit"
                                    startIcon={<TicketIcon />}
                                    onClick={() => navigate("/my-orders")}
                                    sx={{
                                        "&:hover": {
                                            color: "#e50914",
                                        },
                                    }}
                                >
                                    Мои заказы
                                </Button>
                            )}
                            {isAuthenticated && user?.role === "admin" && (
                                <Button
                                    color="inherit"
                                    startIcon={<AdminIcon />}
                                    onClick={() => navigate("/admin")}
                                    sx={{
                                        "&:hover": {
                                            color: "#ffd700",
                                        },
                                    }}
                                >
                                    Админ-панель
                                </Button>
                            )}
                            {isAuthenticated && (user?.role === "admin" || user?.role === "staff") && (
                                <Button
                                    color="inherit"
                                    startIcon={<QrCodeScannerIcon />}
                                    onClick={() => navigate("/controller")}
                                    sx={{
                                        "&:hover": {
                                            color: "#e50914",
                                        },
                                    }}
                                >
                                    Контрольный пункт
                                </Button>
                            )}
                            {isAuthenticated && (user?.role === "admin" || user?.role === "staff") && (
                                <Button
                                    color="inherit"
                                    startIcon={<LocalCafeIcon />}
                                    onClick={() => navigate("/concession-staff")}
                                    sx={{
                                        "&:hover": {
                                            color: "#ffd700",
                                        },
                                    }}
                                >
                                    Кинобар
                                </Button>
                            )}
                        </Box>

                        <Box sx={{ flexGrow: 0 }}>
                            {isAuthenticated ? (
                                <>
                                    <IconButton
                                        size="large"
                                        onClick={handleMenu}
                                        color="inherit"
                                        sx={{
                                            "&:hover": {
                                                backgroundColor:
                                                    "rgba(229, 9, 20, 0.1)",
                                            },
                                        }}
                                    >
                                        <Avatar
                                            sx={{
                                                bgcolor: "#e50914",
                                                width: 40,
                                                height: 40,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {user?.first_name?.[0] ||
                                                user?.email?.[0].toUpperCase()}
                                        </Avatar>
                                    </IconButton>
                                    <Menu
                                        anchorEl={anchorEl}
                                        open={Boolean(anchorEl)}
                                        onClose={handleClose}
                                        anchorOrigin={{
                                            vertical: "bottom",
                                            horizontal: "right",
                                        }}
                                        transformOrigin={{
                                            vertical: "top",
                                            horizontal: "right",
                                        }}
                                        PaperProps={{
                                            sx: {
                                                mt: 1,
                                                minWidth: 200,
                                                background:
                                                    "linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)",
                                                border: "1px solid rgba(229, 9, 20, 0.2)",
                                            },
                                        }}
                                    >
                                        <MenuItem onClick={handleProfile}>
                                            <AccountCircle sx={{ mr: 2 }} />
                                            Профиль
                                        </MenuItem>
                                        <MenuItem onClick={() => { navigate("/my-orders"); handleClose(); }}>
                                            <TicketIcon sx={{ mr: 2 }} />
                                            Мои заказы
                                        </MenuItem>
                                        {user?.role === "admin" && (
                                            <MenuItem onClick={handleAdmin}>
                                                <AdminIcon sx={{ mr: 2 }} />
                                                Админ-панель
                                            </MenuItem>
                                        )}
                                        {(user?.role === "admin" || user?.role === "staff") && (
                                            <MenuItem onClick={() => { navigate("/controller"); handleClose(); }}>
                                                <QrCodeScannerIcon sx={{ mr: 2 }} />
                                                Контрольный пункт
                                            </MenuItem>
                                        )}
                                        {(user?.role === "admin" || user?.role === "staff") && (
                                            <MenuItem onClick={() => { navigate("/concession-staff"); handleClose(); }}>
                                                <LocalCafeIcon sx={{ mr: 2 }} />
                                                Работник кинобара
                                            </MenuItem>
                                        )}
                                        <MenuItem onClick={handleLogout}>
                                            <LogoutIcon sx={{ mr: 2 }} />
                                            Выйти
                                        </MenuItem>
                                    </Menu>
                                </>
                            ) : (
                                <Button
                                    variant="contained"
                                    startIcon={<AccountCircle />}
                                    onClick={() => navigate("/login")}
                                    sx={{
                                        background:
                                            "linear-gradient(135deg, #e50914 0%, #b00710 100%)",
                                        "&:hover": {
                                            background:
                                                "linear-gradient(135deg, #ff1a1a 0%, #cc0812 100%)",
                                            transform: "translateY(-2px)",
                                            boxShadow:
                                                "0 4px 12px rgba(229, 9, 20, 0.4)",
                                        },
                                        transition: "all 0.3s ease",
                                    }}
                                >
                                    Войти
                                </Button>
                            )}
                        </Box>
                    </Toolbar>
                </Container>
            </AppBar>
        </ElevationScroll>
    );
};

export default Header;

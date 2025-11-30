import React, { useState } from 'react';
import {
    Modal,
    Box,
    Tabs,
    Tab,
    Typography,
    IconButton,
    Button
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const AuthModal = ({ open, onClose, onAuthSuccess }) => {
    const [activeTab, setActiveTab] = useState(0);

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    const handleAuthSuccess = () => {
        onAuthSuccess();
        onClose();
    };

    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 400,
                    bgcolor: 'background.paper',
                    border: '2px solid #e50914',
                    borderRadius: 2,
                    boxShadow: 24,
                    p: 4,
                    maxHeight: '90vh',
                    overflowY: 'auto',
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Tabs value={activeTab} onChange={handleTabChange}>
                        <Tab label="Вход" />
                        <Tab label="Регистрация" />
                    </Tabs>
                    <IconButton onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>
                
                {activeTab === 0 ? (
                    <LoginForm onLoginSuccess={handleAuthSuccess} />
                ) : (
                    <RegisterForm onRegisterSuccess={handleAuthSuccess} />
                )}
            </Box>
        </Modal>
    );
};

export default AuthModal;
import React, { lazy, Suspense, useState, useCallback, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useParams, useLocation, useNavigate } from 'react-router-dom';
import Loader from './components/Loader';
import Auth from './components/Auth';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ModalProvider, useModal } from './contexts/ModalContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ConfigProvider } from './contexts/ConfigContext';
import { AdminPreferencesProvider } from './contexts/AdminPreferencesContext';
import ErrorBoundary from './components/ErrorBoundary';
import { PwaInstallProvider } from './contexts/PwaInstallContext';
import ProtectedRoute from './components/ProtectedRoute';
import { useStudentPanel, StudentPanelProvider } from './contexts/StudentPanelContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from './lib/db';
import FinalizacionForm from './components/FinalizacionForm';
import PreSolicitudCheckModal from './components/PreSolicitudCheckModal';
import { NotificationProvider } from './contexts/NotificationContext';
/* Fixed missing Button import */
import Button from './components/Button';
// Views
const StudentView = lazy(() => import('./views/StudentView'));
import StudentDashboard, { StudentHome } from './views/StudentDashboard';
import PracticasView from './views/student/PracticasView';
import SolicitudesView from './views/student/SolicitudesView';
import InformesView from './views/student/InformesView';
import StudentProfileView from './views/student/StudentProfileView';

const AdminView = lazy(() => import('./views/AdminView'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const LanzadorView = lazy(() => import('./views/admin/LanzadorView'));
const GestionView = lazy(() => import('./views/admin/GestionView'));
const HerramientasView = lazy(() => import('./views/admin/HerramientasView'));
const MetricsView = lazy(() => import('./views/admin/MetricsView'));
const SolicitudesManager = lazy(() => import('./components/SolicitudesManager'));
const JefeView = lazy(() => import('./views/JefeView'));
const DirectivoView = lazy(() => import('./views/DirectivoView'));
const ReporteroView = lazy(() => import('./views/ReporteroView'));
const AdminTestingView = lazy(() => import('./views/AdminTestingView'));

const AdminStudentWrapper = () => {
    const { legajo } = useParams();
    if (!legajo) return null;
    return (
        <StudentPanelProvider legajo={legajo}>
            <StudentDashboard key={legajo} user={{ legajo, nombre: 'Estudiante' } as any} showExportButton />
        </StudentPanelProvider>
    );
};


const AppRoutes = () => {
    const { authenticatedUser } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <Routes>
            <Route path="/login" element={!authenticatedUser ? <Auth /> : <Navigate to="/" />} />

            <Route path="/" element={<ProtectedRoute>
                {authenticatedUser?.role === 'AdminTester'
                    ? <Navigate to="/testing" replace />
                    : authenticatedUser?.role === 'SuperUser'
                        ? <Navigate to="/admin" replace />
                        : authenticatedUser?.role === 'Jefe'
                            ? <Navigate to="/jefe" replace />
                            : authenticatedUser?.role === 'Directivo'
                                ? <Navigate to="/directivo" replace />
                                : authenticatedUser?.role === 'Reportero'
                                    ? <Navigate to="/reportero" replace />
                                    : <Navigate to="/student" replace />
                }
            </ProtectedRoute>} />

            <Route path="/student" element={<ProtectedRoute allowedRoles={['Student']}><StudentView /></ProtectedRoute>}>
                <Route index element={<StudentHome />} />
                <Route path="practicas" element={<PracticasView />} />
                <Route path="solicitudes" element={<SolicitudesView />} />
                <Route path="informes" element={<InformesView />} />
                <Route path="perfil" element={<StudentProfileView />} />
            </Route>

            <Route path="/admin" element={<ProtectedRoute allowedRoles={['SuperUser', 'AdminTester']}><AdminView /></ProtectedRoute>}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="metrics" element={<MetricsView onStudentSelect={(s) => navigate(`/admin/estudiantes/${s.legajo}`)} />} />
                <Route path="lanzador" element={<LanzadorView />} />
                <Route path="gestion" element={<GestionView />} />
                <Route path="solicitudes" element={<SolicitudesManager />} />
                <Route path="herramientas" element={<HerramientasView onStudentSelect={(s) => navigate(`/admin/estudiantes/${s[FIELD_LEGAJO_ESTUDIANTES]}`)} />} />
                <Route path="estudiantes/:legajo" element={<AdminStudentWrapper />} />
            </Route>

            <Route path="/jefe" element={<ProtectedRoute allowedRoles={['Jefe']}><JefeView /></ProtectedRoute>} />
            <Route path="/directivo" element={<ProtectedRoute allowedRoles={['Directivo']}><DirectivoView /></ProtectedRoute>} />
            <Route path="/reportero" element={<ProtectedRoute allowedRoles={['Reportero']}><ReporteroView /></ProtectedRoute>} />

            <Route path="/testing" element={<ProtectedRoute allowedRoles={['SuperUser', 'AdminTester']}><AdminTestingView /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

const App: React.FC = () => {
    return (
        <Router>
            <ConfigProvider>
                <AdminPreferencesProvider>
                    <NotificationProvider>
                        <PwaInstallProvider>
                            <ThemeProvider>
                                <ModalProvider>
                                    <ErrorBoundary>
                                        <Layout>
                                            <Suspense fallback={<Loader />}>
                                                <AppRoutes />
                                            </Suspense>
                                        </Layout>
                                    </ErrorBoundary>
                                </ModalProvider>
                            </ThemeProvider>
                        </PwaInstallProvider>
                    </NotificationProvider>
                </AdminPreferencesProvider>
            </ConfigProvider>
        </Router>
    );
};

export default App;
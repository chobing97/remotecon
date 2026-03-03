import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App';
import LoginPage from './pages/LoginPage';
import SessionsPage from './pages/SessionsPage';
import TerminalPage from './pages/TerminalPage';
import RecordingsPage from './pages/RecordingsPage';
import RecordingPlayerPage from './pages/RecordingPlayerPage';
import WebhooksPage from './pages/WebhooksPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <SessionsPage /> },
      { path: 'terminal', element: <TerminalPage /> },
      { path: 'recordings', element: <RecordingsPage /> },
      { path: 'recordings/:id', element: <RecordingPlayerPage /> },
      { path: 'webhooks', element: <WebhooksPage /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

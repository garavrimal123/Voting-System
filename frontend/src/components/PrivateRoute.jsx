import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ role, children }) {
  const { role: currentRole } = useAuth();
  if (currentRole !== role) {
    return <Navigate to={role === 'admin' ? '/admin/login' : '/login'} replace />;
  }
  return children;
}

import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [role, setRole] = useState(sessionStorage.getItem('role'));

  function login(token, role) {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('role', role);
    setRole(role);
  }

  function logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    setRole(null);
  }

  return (
    <AuthContext.Provider value={{ role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

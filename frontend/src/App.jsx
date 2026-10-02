import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';

import Home from './pages/Home';
import Register from './pages/Register';
import RegistrationSuccess from './pages/RegistrationSuccess';
import TrackApplication from './pages/TrackApplication';
import VoterLogin from './pages/VoterLogin';
import ForgotPassword from './pages/ForgotPassword';
import ChangePassword from './pages/ChangePassword';
import VoterDashboard from './pages/VoterDashboard';
import VoterProfile from './pages/VoterProfile';
import CastVote from './pages/CastVote';
import ElectionResults from './pages/ElectionResults';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminElections from './pages/AdminElections';
import AdminElectionDetail from './pages/AdminElectionDetail';
import AdminUpdateRequests from './pages/AdminUpdateRequests';
import AdminAuditLog from './pages/AdminAuditLog';
import PublicResults from './pages/PublicResults';

export default function App() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/registration-success" element={<RegistrationSuccess />} />
          <Route path="/track" element={<TrackApplication />} />
          <Route path="/public-results" element={<PublicResults />} />
          <Route path="/public-results/:electionId" element={<PublicResults />} />
          <Route path="/login" element={<VoterLogin />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/change-password" element={<ChangePassword />} />

          <Route path="/dashboard" element={
            <PrivateRoute role="voter"><VoterDashboard /></PrivateRoute>
          } />
          <Route path="/profile" element={
            <PrivateRoute role="voter"><VoterProfile /></PrivateRoute>
          } />
          <Route path="/vote/:electionId" element={
            <PrivateRoute role="voter"><CastVote /></PrivateRoute>
          } />
          <Route path="/results/:electionId" element={
            <PrivateRoute role="voter"><ElectionResults /></PrivateRoute>
          } />

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={
            <PrivateRoute role="admin"><AdminDashboard /></PrivateRoute>
          } />
          <Route path="/admin/elections" element={
            <PrivateRoute role="admin"><AdminElections /></PrivateRoute>
          } />
          <Route path="/admin/elections/:electionId" element={
            <PrivateRoute role="admin"><AdminElectionDetail /></PrivateRoute>
          } />
          <Route path="/admin/update-requests" element={
            <PrivateRoute role="admin"><AdminUpdateRequests /></PrivateRoute>
          } />
          <Route path="/admin/audit-log" element={
            <PrivateRoute role="admin"><AdminAuditLog /></PrivateRoute>
          } />

          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </>
  );
}

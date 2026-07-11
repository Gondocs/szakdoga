import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { EventLayout } from '../components/layout/EventLayout';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { LoginPage } from '../features/auth/LoginPage';
import { HomePage } from '../features/home/HomePage';
import { EventListPage } from '../features/events/EventListPage';
import { EventDashboardPage } from '../features/dashboard/EventDashboardPage';
import { PersonListPage } from '../features/persons/PersonListPage';
import { PersonDetailPage } from '../features/persons/PersonDetailPage';
import { RegistrationWizardPage } from '../features/registrations/RegistrationWizardPage';
import { ShelterListPage } from '../features/shelters/ShelterListPage';
import { ShelterManagementPage } from '../features/shelters/ShelterManagementPage';
import { QrCheckInPage } from '../features/checkins/QrCheckInPage';
import { AuditLogPage } from '../features/audit/AuditLogPage';
import { SelfRegisterPage } from '../features/selfservice/SelfRegisterPage';
import { SelfProfilePage } from '../features/selfservice/SelfProfilePage';
import { UserManagementPage } from '../features/users/UserManagementPage';
import { FamilyDetailPage } from '../features/families/FamilyDetailPage';
import { FamilyListPage } from '../features/families/FamilyListPage';
import { FamilyReunificationPage } from '../features/families/FamilyReunificationPage';
import { TransportPage } from '../features/transports/TransportPage';
import { EventMapPage } from '../features/map/EventMapPage';
import { VehicleListPage } from '../features/vehicles/VehicleListPage';
import { MunicipalityManagementPage } from '../features/municipalities/MunicipalityManagementPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { IncidentListPage } from '../features/incidents/IncidentListPage';
import { RepatriationPage } from '../features/repatriation/RepatriationPage';
import { NotFoundPage } from '../features/errors/NotFoundPage';

export const router = createBrowserRouter([
  { path: '/bejelentkezes', element: <LoginPage /> },
  { path: '/onkiszolgalo/:eventCode', element: <SelfRegisterPage /> },
  { path: '/onkiszolgalo/profil/:publicId', element: <SelfProfilePage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'esemenyek', element: <EventListPage /> },
      { path: 'esemenyek/:eventId/uj-regisztracio', element: <RegistrationWizardPage /> },
      { path: 'esemenyek/:eventId/erkeztetes', element: <QrCheckInPage /> },
      {
        path: 'esemenyek/:eventId',
        element: <EventLayout />,
        children: [
          { path: 'attekintes', element: <EventDashboardPage /> },
          { path: 'szemelyek', element: <PersonListPage /> },
          { path: 'befogadohelyek', element: <ShelterListPage /> },
          { path: 'szallitas', element: <TransportPage /> },
          { path: 'terkep', element: <EventMapPage /> },
          { path: 'csaladok', element: <FamilyListPage /> },
          { path: 'csaladok/egyesites', element: <FamilyReunificationPage /> },
          { path: 'rendkivuli-esemenyek', element: <IncidentListPage /> },
          { path: 'visszatelepites', element: <RepatriationPage /> },
        ],
      },
      { path: 'szemelyek/:personId', element: <PersonDetailPage /> },
      { path: 'csaladok/:familyId', element: <FamilyDetailPage /> },
      { path: 'befogadohelyek', element: <ShelterManagementPage /> },
      { path: 'telepulesek', element: <MunicipalityManagementPage /> },
      { path: 'jarmuvek', element: <VehicleListPage /> },
      {
        path: 'felhasznalok',
        element: (
          <ProtectedRoute allow={['admin']}>
            <UserManagementPage />
          </ProtectedRoute>
        ),
      },
      { path: 'naplo', element: <AuditLogPage /> },
      { path: 'beallitasok', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);

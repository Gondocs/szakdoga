import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
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
      { path: 'esemenyek/:eventId/attekintes', element: <EventDashboardPage /> },
      { path: 'esemenyek/:eventId/szemelyek', element: <PersonListPage /> },
      { path: 'esemenyek/:eventId/uj-regisztracio', element: <RegistrationWizardPage /> },
      { path: 'esemenyek/:eventId/befogadohelyek', element: <ShelterListPage /> },
      { path: 'esemenyek/:eventId/erkeztetes', element: <QrCheckInPage /> },
      { path: 'esemenyek/:eventId/szallitas', element: <TransportPage /> },
      { path: 'esemenyek/:eventId/terkep', element: <EventMapPage /> },
      { path: 'esemenyek/:eventId/csaladok', element: <FamilyListPage /> },
      { path: 'esemenyek/:eventId/csaladok/egyesites', element: <FamilyReunificationPage /> },
      { path: 'esemenyek/:eventId/rendkivuli-esemenyek', element: <IncidentListPage /> },
      { path: 'esemenyek/:eventId/visszatelepites', element: <RepatriationPage /> },
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
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);

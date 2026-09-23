import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from '@/app/Layout';
import { RequiertConnexion } from '@/app/RequiertConnexion';
import { Connexion } from '@/pages/Connexion';
import { Dashboard } from '@/pages/Dashboard';
import { Corbeille } from '@/pages/Corbeille';
import { Parapheur } from '@/pages/Parapheur';
import { Information } from '@/pages/Information';
import { Recherche } from '@/pages/Recherche';
import { Expeditions } from '@/pages/Expeditions';
import { ReponsesAttendues } from '@/pages/ReponsesAttendues';
import { Correspondants } from '@/pages/Correspondants';
import { CorrespondantDetail } from '@/pages/CorrespondantDetail';
import { Suivi } from '@/pages/Suivi';
import { Portail } from '@/pages/Portail';
import { Verifier } from '@/pages/Verifier';
import { EntrantNouveau } from '@/pages/courriers/EntrantNouveau';
import { SortantNouveau } from '@/pages/courriers/SortantNouveau';
import { RegistreEntrant } from '@/pages/courriers/RegistreEntrant';
import { RegistreSortant } from '@/pages/courriers/RegistreSortant';
import { Detail } from '@/pages/courriers/Detail';
import { Personnalisation } from '@/pages/admin/Personnalisation';
import { Journal } from '@/pages/admin/Journal';
import { Donnees } from '@/pages/admin/Donnees';
import { Organigramme } from '@/pages/admin/Organigramme';
import { Circuits } from '@/pages/admin/Circuits';
import { ModelesLettre } from '@/pages/admin/ModelesLettre';

export const router = createBrowserRouter([
  { path: '/connexion', element: <Connexion /> },
  { path: '/portail', element: <Portail /> },
  { path: '/verifier', element: <Verifier /> },
  { path: '/verifier/:signatureId', element: <Verifier /> },
  {
    element: (
      <RequiertConnexion>
        <Layout />
      </RequiertConnexion>
    ),
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/corbeille', element: <Corbeille /> },
      { path: '/parapheur', element: <Parapheur /> },
      { path: '/information', element: <Information /> },
      { path: '/recherche', element: <Recherche /> },
      { path: '/suivi/:code', element: <Suivi /> },
      { path: '/courriers/entrants', element: <RegistreEntrant /> },
      { path: '/courriers/entrants/nouveau', element: <EntrantNouveau /> },
      { path: '/courriers/sortants', element: <RegistreSortant /> },
      { path: '/courriers/sortants/nouveau', element: <SortantNouveau /> },
      { path: '/courriers/:id', element: <Detail /> },
      { path: '/expeditions', element: <Expeditions /> },
      { path: '/reponses-attendues', element: <ReponsesAttendues /> },
      { path: '/correspondants', element: <Correspondants /> },
      { path: '/correspondants/:id', element: <CorrespondantDetail /> },
      { path: '/admin/personnalisation', element: <Personnalisation /> },
      { path: '/admin/journal', element: <Journal /> },
      { path: '/admin/donnees', element: <Donnees /> },
      { path: '/admin/organigramme', element: <Organigramme /> },
      { path: '/admin/circuits', element: <Circuits /> },
      { path: '/admin/modeles-lettre', element: <ModelesLettre /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

import type { RouteRecordRaw } from "vue-router";

import LoginPage from "@/pages/auth/LoginPage.vue";
import IncidentListPage from "@/pages/incidents/IncidentListPage.vue";
import IncidentDetailPage from "@/pages/incidents/IncidentDetailPage.vue";
import IncidentCreatePage from "@/pages/incidents/IncidentCreatePage.vue";
import SettingsPage from "@/pages/settings/SettingsPage.vue";
import IntegrationsPage from "@/pages/settings/IntegrationsPage.vue";
import MembersPage from "@/pages/organization/MembersPage.vue";
import TeamsListPage from "@/pages/teams/TeamsListPage.vue";
import TeamDetailPage from "@/pages/teams/TeamDetailPage.vue";
import ServicesPage from "@/pages/services/ServicesPage.vue";

export const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "login",
    component: LoginPage,
    meta: { public: true }
  },
  {
    path: "/",
    name: "incidents",
    component: IncidentListPage
  },
  {
    path: "/incidents/:id",
    name: "incident-detail",
    component: IncidentDetailPage
  },
  {
    path: "/incidents/new",
    name: "incident-create",
    component: IncidentCreatePage
  },
  {
    path: "/organization/members",
    name: "organization-members",
    component: MembersPage
  },
  {
    path: "/teams",
    name: "teams",
    component: TeamsListPage
  },
  {
    path: "/teams/:id",
    name: "teams-detail",
    component: TeamDetailPage
  },
  {
    path: "/settings",
    name: "settings",
    component: SettingsPage
  },
  {
    path: "/settings/integrations",
    name: "settings-integrations",
    component: IntegrationsPage
  },
  {
    path: "/services",
    name: "services",
    component: ServicesPage
  }
];

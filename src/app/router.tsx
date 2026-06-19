import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { HomePage } from "@/pages/HomePage";
import { InboxPage } from "@/pages/InboxPage";
import { MyWorkPage } from "@/pages/MyWorkPage";
import { ImportLogPage } from "@/pages/ImportLogPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { ContractSummaryPage } from "@/pages/ContractSummaryPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { SamplesPage } from "@/pages/SamplesPage";
import { DiaryPage } from "@/pages/DiaryPage";
import { QuantityBookPage } from "@/pages/QuantityBookPage";
import { PayEstimatePage } from "@/pages/PayEstimatePage";
import { AuthorizationsPage } from "@/pages/AuthorizationsPage";
import { MaterialDefinitionPage, VendorsPage, MixDesignPage } from "@/pages/MaterialsPages";
import { MaterialAllowancePage } from "@/pages/MaterialAllowancePage";
import {
  MaterialsInventoryPage,
  MaterialsAcceptancePage,
  InspectorsPage,
  LaboratoryPage,
  DescriptionsPage,
} from "@/pages/MaterialsMenuPages";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "inbox", element: <InboxPage /> },
      { path: "my-work", element: <MyWorkPage /> },
      { path: "import-log", element: <ImportLogPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "samples", element: <SamplesPage /> },
      { path: "samples/:sampleId", element: <SamplesPage /> },
      { path: "materials/definitions", element: <MaterialDefinitionPage /> },
      { path: "materials/vendors", element: <VendorsPage /> },
      { path: "materials/mix-designs", element: <MixDesignPage /> },
      { path: "materials/inventory", element: <MaterialsInventoryPage /> },
      { path: "materials/acceptance", element: <MaterialsAcceptancePage /> },
      { path: "materials/inspectors", element: <InspectorsPage /> },
      { path: "materials/laboratory", element: <LaboratoryPage /> },
      { path: "materials/descriptions", element: <DescriptionsPage /> },
      { path: "contract/:contractId", element: <ContractSummaryPage /> },
      // Inventory grid; the optional :itemId opens the detail drawer over it.
      { path: "contract/:contractId/inventory", element: <InventoryPage /> },
      { path: "contract/:contractId/inventory/:itemId", element: <InventoryPage /> },
      { path: "contract/:contractId/diary", element: <DiaryPage /> },
      { path: "contract/:contractId/quantity-book", element: <QuantityBookPage /> },
      { path: "contract/:contractId/material-allowance", element: <MaterialAllowancePage /> },
      { path: "contract/:contractId/pay-estimate", element: <PayEstimatePage /> },
      { path: "contract/:contractId/authorizations", element: <AuthorizationsPage /> },
    ],
  },
]);

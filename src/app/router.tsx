import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { HomePage } from "@/pages/HomePage";
import { InboxPage } from "@/pages/InboxPage";
import { ContractSummaryPage } from "@/pages/ContractSummaryPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { SamplesPage } from "@/pages/SamplesPage";
import { DiaryPage } from "@/pages/DiaryPage";
import { QuantityBookPage } from "@/pages/QuantityBookPage";
import { PayEstimatePage } from "@/pages/PayEstimatePage";
import { AuthorizationsPage } from "@/pages/AuthorizationsPage";
import { MaterialDefinitionPage, VendorsPage, MixDesignPage } from "@/pages/MaterialsPages";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "inbox", element: <InboxPage /> },
      { path: "samples", element: <SamplesPage /> },
      { path: "samples/:sampleId", element: <SamplesPage /> },
      { path: "materials/definitions", element: <MaterialDefinitionPage /> },
      { path: "materials/vendors", element: <VendorsPage /> },
      { path: "materials/mix-designs", element: <MixDesignPage /> },
      { path: "contract/:contractId", element: <ContractSummaryPage /> },
      // Inventory grid; the optional :itemId opens the detail drawer over it.
      { path: "contract/:contractId/inventory", element: <InventoryPage /> },
      { path: "contract/:contractId/inventory/:itemId", element: <InventoryPage /> },
      { path: "contract/:contractId/diary", element: <DiaryPage /> },
      { path: "contract/:contractId/quantity-book", element: <QuantityBookPage /> },
      { path: "contract/:contractId/pay-estimate", element: <PayEstimatePage /> },
      { path: "contract/:contractId/authorizations", element: <AuthorizationsPage /> },
    ],
  },
]);

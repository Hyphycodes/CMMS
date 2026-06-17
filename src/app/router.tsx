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
import { StubPage } from "@/pages/StubPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "inbox", element: <InboxPage /> },
      { path: "samples", element: <SamplesPage /> },
      { path: "samples/:sampleId", element: <SamplesPage /> },
      { path: "contract/:contractId", element: <ContractSummaryPage /> },
      // Inventory grid; the optional :itemId opens the detail drawer over it.
      { path: "contract/:contractId/inventory", element: <InventoryPage /> },
      { path: "contract/:contractId/inventory/:itemId", element: <InventoryPage /> },
      { path: "contract/:contractId/diary", element: <DiaryPage /> },
      { path: "contract/:contractId/quantity-book", element: <QuantityBookPage /> },
      { path: "contract/:contractId/pay-estimate", element: <PayEstimatePage /> },
      // Replaced by a real module in brief 10.
      { path: "contract/:contractId/authorizations", element: <StubPage node="Authorizations" /> },
    ],
  },
]);

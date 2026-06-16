import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { InboxPage } from "@/pages/InboxPage";
import { ContractSummaryPage } from "@/pages/ContractSummaryPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { StubPage } from "@/pages/StubPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/inbox" replace /> },
      { path: "inbox", element: <InboxPage /> },
      { path: "contract/:contractId", element: <ContractSummaryPage /> },
      // Inventory grid; the optional :itemId opens the detail drawer over it.
      { path: "contract/:contractId/inventory", element: <InventoryPage /> },
      { path: "contract/:contractId/inventory/:itemId", element: <InventoryPage /> },
      { path: "contract/:contractId/diary", element: <StubPage node="Diary" /> },
      { path: "contract/:contractId/quantity-book", element: <StubPage node="Quantity Book" /> },
      { path: "contract/:contractId/pay-estimate", element: <StubPage node="Pay Estimate" /> },
      { path: "contract/:contractId/authorizations", element: <StubPage node="Authorizations" /> },
    ],
  },
]);

type JsonRecord = Record<string, unknown>;

type LoginResponse = {
  data?: {
    accessToken?: string;
    user?: {
      companyId?: string;
    };
  };
};

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function parseJson(response: Response): Promise<JsonRecord> {
  try {
    return (await response.json()) as JsonRecord;
  } catch {
    return {};
  }
}

async function assertOk(response: Response, step: string): Promise<JsonRecord> {
  const body = await parseJson(response);
  if (!response.ok) {
    const details = JSON.stringify(body);
    throw new Error(`${step} failed (${response.status}): ${details}`);
  }
  return body;
}

async function main(): Promise<void> {
  const baseUrl = getEnv("SMOKE_API_BASE_URL", "http://localhost:3001/api/v1");
  const email = getEnv("SMOKE_EMAIL", "admin@demo.com");
  const password = getEnv("SMOKE_PASSWORD", "demo@123");

  const now = Date.now();
  const categoryCode = `SMK${String(now).slice(-6)}`;
  const sku = `SKU-${String(now).slice(-8)}`;

  console.log("[smoke] Logging in...");
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const loginBody = (await assertOk(loginRes, "Login")) as LoginResponse;
  const accessToken = loginBody.data?.accessToken;
  const companyId = loginBody.data?.user?.companyId;

  if (!accessToken || !companyId) {
    throw new Error("Login did not return accessToken/companyId");
  }

  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    "x-company-id": companyId,
    "Content-Type": "application/json",
  };

  console.log("[smoke] Verifying auth/me...");
  await assertOk(
    await fetch(`${baseUrl}/auth/me`, { headers: authHeaders }),
    "Get current user"
  );

  console.log("[smoke] Inventory: create category...");
  const categoryBody = await assertOk(
    await fetch(`${baseUrl}/inventory/categories`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: `Smoke Category ${now}`,
        code: categoryCode,
        description: "Smoke test category",
      }),
    }),
    "Create inventory category"
  );
  const categoryId = (categoryBody.data as JsonRecord | undefined)?.id as string | undefined;
  if (!categoryId) {
    throw new Error("Category creation did not return id");
  }

  console.log("[smoke] Inventory: create supplier...");
  const supplierBody = await assertOk(
    await fetch(`${baseUrl}/inventory/suppliers`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: `Smoke Supplier ${now}`,
        email: `smoke-supplier-${now}@example.com`,
        phone: "+10000000000",
      }),
    }),
    "Create supplier"
  );
  const supplierId = (supplierBody.data as JsonRecord | undefined)?.id as string | undefined;
  if (!supplierId) {
    throw new Error("Supplier creation did not return id");
  }

  console.log("[smoke] Inventory: create product...");
  const productBody = await assertOk(
    await fetch(`${baseUrl}/inventory/products`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        sku,
        name: `Smoke Product ${now}`,
        categoryId,
        unit: "pcs",
        costPrice: 10,
        sellingPrice: 15,
        quantity: 20,
        reorderLevel: 5,
      }),
    }),
    "Create product"
  );
  const productId = (productBody.data as JsonRecord | undefined)?.id as string | undefined;
  if (!productId) {
    throw new Error("Product creation did not return id");
  }

  console.log("[smoke] Inventory: create PO and receive...");
  const poBody = await assertOk(
    await fetch(`${baseUrl}/inventory/purchase-orders`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        supplierId,
        notes: "Smoke PO",
        items: [{ productId, quantity: 3, unitPrice: 9 }],
      }),
    }),
    "Create purchase order"
  );
  const poId = (poBody.data as JsonRecord | undefined)?.id as string | undefined;
  if (!poId) {
    throw new Error("Purchase order creation did not return id");
  }

  const poListBody = await assertOk(
    await fetch(`${baseUrl}/inventory/purchase-orders`, { headers: authHeaders }),
    "List purchase orders"
  );
  const poList = (poListBody.data as Array<JsonRecord> | undefined) ?? [];
  const createdPo = poList.find((po) => po.id === poId);
  const poItems = (createdPo?.items as Array<JsonRecord> | undefined) ?? [];
  const firstPoItem = poItems[0];
  const purchaseItemId = firstPoItem?.id as string | undefined;
  if (!purchaseItemId) {
    throw new Error("Purchase item id not found for created PO");
  }

  await assertOk(
    await fetch(`${baseUrl}/inventory/purchase-orders/${poId}/receive`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        items: [{ purchaseItemId, receiveQty: 3 }],
      }),
    }),
    "Receive purchase order"
  );

  console.log("[smoke] Sales: create customer/order/invoice/payment...");
  const customerBody = await assertOk(
    await fetch(`${baseUrl}/sales/customers`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: `Smoke Customer ${now}`,
        email: `smoke-customer-${now}@example.com`,
      }),
    }),
    "Create customer"
  );
  const customerId = (customerBody.data as JsonRecord | undefined)?.id as string | undefined;
  if (!customerId) {
    throw new Error("Customer creation did not return id");
  }

  const orderBody = await assertOk(
    await fetch(`${baseUrl}/sales/orders`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        customerId,
        items: [{ productId, quantity: 2 }],
      }),
    }),
    "Create sales order"
  );
  const soId = (orderBody.data as JsonRecord | undefined)?.id as string | undefined;
  if (!soId) {
    throw new Error("Sales order creation did not return id");
  }

  const invoiceBody = await assertOk(
    await fetch(`${baseUrl}/sales/invoices`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        customerId,
        soId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    }),
    "Create invoice"
  );
  const invoiceData = (invoiceBody.data as JsonRecord | undefined) ?? {};
  const invoiceId = invoiceData.id as string | undefined;
  const invoiceTotal = (invoiceData.totalAmount as number | undefined) ?? 0;
  if (!invoiceId || invoiceTotal <= 0) {
    throw new Error("Invoice creation did not return valid id/amount");
  }

  await assertOk(
    await fetch(`${baseUrl}/sales/payments`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        invoiceId,
        amount: Number((invoiceTotal / 2).toFixed(2)),
        paymentMethod: "cash",
      }),
    }),
    "Record invoice payment"
  );

  console.log("[smoke] Accounting: create/post journal + fetch reports...");
  const journalBody = await assertOk(
    await fetch(`${baseUrl}/accounting/journal-entries`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        entryDate: new Date().toISOString(),
        description: `Smoke JE ${now}`,
        reference: `SMK-${now}`,
        totalDebit: 100,
        totalCredit: 100,
        status: "draft",
      }),
    }),
    "Create journal entry"
  );
  const journalId = (journalBody.data as JsonRecord | undefined)?.id as string | undefined;
  if (!journalId) {
    throw new Error("Journal creation did not return id");
  }

  await assertOk(
    await fetch(`${baseUrl}/accounting/journal-entries/${journalId}/status`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "posted" }),
    }),
    "Post journal entry"
  );

  await assertOk(await fetch(`${baseUrl}/accounting/ledger`, { headers: authHeaders }), "Get ledger");
  await assertOk(await fetch(`${baseUrl}/accounting/trial-balance`, { headers: authHeaders }), "Get trial balance");
  await assertOk(await fetch(`${baseUrl}/accounting/financial-reports`, { headers: authHeaders }), "Get financial report");

  console.log("[smoke] SUCCESS: Sales + Inventory + Accounting smoke flow completed.");
}

main().catch((error) => {
  console.error("[smoke] FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});

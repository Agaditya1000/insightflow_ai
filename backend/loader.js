require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const db = require('./db');

const DATA_DIR = path.join(__dirname, '..', 'sap-o2c-data');

async function readJsonl(filePath) {
  const rows = [];
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) {
      try { rows.push(JSON.parse(line)); } catch {}
    }
  }
  return rows;
}

async function loadDir(dirName) {
  const dirPath = path.join(DATA_DIR, dirName);
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
  let all = [];
  for (const file of files) {
    const rows = await readJsonl(path.join(dirPath, file));
    all = all.concat(rows);
  }
  return all;
}

async function main() {
  console.log('Loading data into SQLite...');

  // sales_order_headers
  const soh = await loadDir('sales_order_headers');
  const insSoh = db.prepare(`INSERT OR IGNORE INTO sales_order_headers VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const runSoh = db.transaction((rows) => {
    for (const r of rows) insSoh.run(r.salesOrder,r.salesOrderType,r.salesOrganization,r.distributionChannel,r.organizationDivision,r.salesGroup,r.salesOffice,r.soldToParty,r.creationDate,r.createdByUser,r.lastChangeDateTime,r.totalNetAmount,r.overallDeliveryStatus,r.overallOrdReltdBillgStatus,r.overallSdDocReferenceStatus,r.transactionCurrency,r.pricingDate,r.requestedDeliveryDate,r.headerBillingBlockReason,r.deliveryBlockReason,r.incotermsClassification,r.incotermsLocation1,r.customerPaymentTerms,r.totalCreditCheckStatus);
  });
  runSoh(soh);
  console.log(`✓ sales_order_headers: ${soh.length} rows`);

  // sales_order_items
  const soi = await loadDir('sales_order_items');
  const insSoi = db.prepare(`INSERT OR IGNORE INTO sales_order_items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const runSoi = db.transaction((rows) => {
    for (const r of rows) insSoi.run(r.salesOrder,r.salesOrderItem,r.material,r.salesOrderItemText,r.requestedQuantity,r.requestedQuantityUnit,r.itemGrossWeight,r.itemNetWeight,r.itemWeightUnit,r.netAmount,r.transactionCurrency,r.materialGroup,r.productionPlant,r.storageLocation,r.deliveryGroup,r.shippingPoint);
  });
  runSoi(soi);
  console.log(`✓ sales_order_items: ${soi.length} rows`);

  // sales_order_schedule_lines
  const sosl = await loadDir('sales_order_schedule_lines');
  const insSosl = db.prepare(`INSERT OR IGNORE INTO sales_order_schedule_lines VALUES (?,?,?,?,?,?,?,?,?)`);
  const runSosl = db.transaction((rows) => {
    for (const r of rows) insSosl.run(r.salesOrder,r.salesOrderItem,r.scheduleLine||'1',r.requestedDeliveryDate,r.confirmedDeliveryDate,r.scheduledQuantity,r.deliveredQuantityInBaseUnit,r.correctedQtyInBaseUnit,r.orderQuantityUnit);
  });
  runSosl(sosl);
  console.log(`✓ sales_order_schedule_lines: ${sosl.length} rows`);

  // billing_document_headers
  const bdh = await loadDir('billing_document_headers');
  const insBdh = db.prepare(`INSERT OR IGNORE INTO billing_document_headers VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const runBdh = db.transaction((rows) => {
    for (const r of rows) {
      const ct = r.creationTime || {};
      insBdh.run(r.billingDocument,r.billingDocumentType,r.creationDate,ct.hours||0,ct.minutes||0,ct.seconds||0,r.lastChangeDateTime,r.billingDocumentDate,r.billingDocumentIsCancelled?1:0,r.cancelledBillingDocument,r.totalNetAmount,r.transactionCurrency,r.companyCode,r.fiscalYear,r.accountingDocument,r.soldToParty);
    }
  });
  runBdh(bdh);
  console.log(`✓ billing_document_headers: ${bdh.length} rows`);

  // billing_document_items
  const bdi = await loadDir('billing_document_items');
  const insBdi = db.prepare(`INSERT OR IGNORE INTO billing_document_items VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const runBdi = db.transaction((rows) => {
    for (const r of rows) insBdi.run(r.billingDocument,r.billingDocumentItem,r.material,r.billingQuantity,r.billingQuantityUnit,r.netAmount,r.transactionCurrency,r.plant,r.salesDocument,r.salesDocumentItem,r.referenceSDDocument,r.referenceSDDocumentItem);
  });
  runBdi(bdi);
  console.log(`✓ billing_document_items: ${bdi.length} rows`);

  // billing_document_cancellations
  const bdc = await loadDir('billing_document_cancellations');
  const insBdc = db.prepare(`INSERT OR IGNORE INTO billing_document_cancellations VALUES (?,?,?,?,?,?,?)`);
  const runBdc = db.transaction((rows) => {
    for (const r of rows) {
      const ct = r.creationTime || {};
      insBdc.run(r.billingDocument,r.cancelledBillingDocument,r.cancellationReason,r.creationDate,ct.hours||0,ct.minutes||0,ct.seconds||0);
    }
  });
  runBdc(bdc);
  console.log(`✓ billing_document_cancellations: ${bdc.length} rows`);

  // outbound_delivery_headers
  const odh = await loadDir('outbound_delivery_headers');
  const insOdh = db.prepare(`INSERT OR IGNORE INTO outbound_delivery_headers VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const runOdh = db.transaction((rows) => {
    for (const r of rows) insOdh.run(r.deliveryDocument,r.deliveryDocumentType,r.shippingPoint,r.deliveryDate,r.creationDate,r.createdByUser,r.lastChangeDateTime,r.deliveryDocumentBySupplier,r.salesOrganization,r.soldToParty,r.shiptoParty,r.overallGoodsMovementStatus,r.overallPickingStatus,r.overallPackingStatus,r.overallDeliveryStatus);
  });
  runOdh(odh);
  console.log(`✓ outbound_delivery_headers: ${odh.length} rows`);

  // outbound_delivery_items
  const odi = await loadDir('outbound_delivery_items');
  const insOdi = db.prepare(`INSERT OR IGNORE INTO outbound_delivery_items VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const runOdi = db.transaction((rows) => {
    for (const r of rows) insOdi.run(r.deliveryDocument,r.deliveryDocumentItem,r.referenceSDDocument,r.referenceSDDocumentItem,r.material,r.deliveryQuantity,r.deliveryQuantityUnit,r.plant,r.storageLocation,r.batch,r.actualDeliveryRoute);
  });
  runOdi(odi);
  console.log(`✓ outbound_delivery_items: ${odi.length} rows`);

  // journal_entry_items
  const jei = await loadDir('journal_entry_items_accounts_receivable');
  const insJei = db.prepare(`INSERT OR IGNORE INTO journal_entry_items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const runJei = db.transaction((rows) => {
    for (const r of rows) insJei.run(r.accountingDocument,r.accountingDocumentItem||'1',r.companyCode,r.fiscalYear,r.glAccount,r.referenceDocument,r.costCenter,r.profitCenter,r.transactionCurrency,r.amountInTransactionCurrency,r.companyCodeCurrency,r.amountInCompanyCodeCurrency,r.postingDate,r.documentDate,r.accountingDocumentType,r.assignmentReference,r.lastChangeDateTime,r.customer,r.financialAccountType,r.clearingDate,r.clearingAccountingDocument,r.clearingDocFiscalYear);
  });
  runJei(jei);
  console.log(`✓ journal_entry_items: ${jei.length} rows`);

  // payments_ar
  const par = await loadDir('payments_accounts_receivable');
  const insPar = db.prepare(`INSERT OR IGNORE INTO payments_ar VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const runPar = db.transaction((rows) => {
    for (const r of rows) insPar.run(r.accountingDocument,r.companyCode,r.fiscalYear,r.glAccount,r.referenceDocument,r.costCenter,r.profitCenter,r.transactionCurrency,r.amountInTransactionCurrency,r.companyCodeCurrency,r.amountInCompanyCodeCurrency,r.postingDate,r.documentDate,r.accountingDocumentType,r.customer,r.financialAccountType);
  });
  runPar(par);
  console.log(`✓ payments_ar: ${par.length} rows`);

  // business_partners
  const bp = await loadDir('business_partners');
  const insBp = db.prepare(`INSERT OR IGNORE INTO business_partners VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const runBp = db.transaction((rows) => {
    for (const r of rows) insBp.run(r.businessPartner,r.businessPartnerFullName,r.businessPartnerFirstName,r.businessPartnerLastName,r.businessPartnerGrouping,r.birthDate,r.bpCreditStanding,r.academicTitle,r.academicTitle2,r.additionalLastName);
  });
  runBp(bp);
  console.log(`✓ business_partners: ${bp.length} rows`);

  // business_partner_addresses
  const bpa = await loadDir('business_partner_addresses');
  const insBpa = db.prepare(`INSERT OR IGNORE INTO business_partner_addresses VALUES (?,?,?,?,?,?,?,?)`);
  const runBpa = db.transaction((rows) => {
    for (const r of rows) insBpa.run(r.businessPartner,r.addressID||r.addressId,r.streetName,r.houseNumber,r.cityName,r.region,r.postalCode,r.country);
  });
  runBpa(bpa);
  console.log(`✓ business_partner_addresses: ${bpa.length} rows`);

  // customer_company_assignments
  const cca = await loadDir('customer_company_assignments');
  const insCca = db.prepare(`INSERT OR IGNORE INTO customer_company_assignments VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const runCca = db.transaction((rows) => {
    for (const r of rows) insCca.run(r.customer,r.companyCode,r.paymentTerms,r.accountGroup,r.dueDateCalculationBase,r.cashDiscountDaysOne,r.cashDiscountDaysTwo,r.cashDiscountPercentageOne,r.cashDiscountPercentageTwo,r.netPaymentDays,r.creditControlArea,r.customerAccountGroup);
  });
  runCca(cca);
  console.log(`✓ customer_company_assignments: ${cca.length} rows`);

  // customer_sales_area_assignments
  const csaa = await loadDir('customer_sales_area_assignments');
  const insCsaa = db.prepare(`INSERT OR IGNORE INTO customer_sales_area_assignments VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const runCsaa = db.transaction((rows) => {
    for (const r of rows) insCsaa.run(r.customer,r.salesOrganization,r.distributionChannel,r.division,r.salesOffice,r.salesGroup,r.deliveryPriority,r.orderProbabilityInPercent,r.customerPaymentTerms,r.incotermsClassification,r.incotermsVersion,r.incotermsLocation1,r.incotermsLocation2);
  });
  runCsaa(csaa);
  console.log(`✓ customer_sales_area_assignments: ${csaa.length} rows`);

  // products
  const prod = await loadDir('products');
  const insProd = db.prepare(`INSERT OR IGNORE INTO products VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const runProd = db.transaction((rows) => {
    for (const r of rows) insProd.run(r.product,r.baseUnit,r.productType,r.grossWeight,r.netWeight,r.weightUnit,r.volumeUnit,r.volume,r.materialGroup,r.productGroup,r.externalProductGroup,r.crossPlantStatus,r.crossPlantStatusValidityDate,r.creationDate);
  });
  runProd(prod);
  console.log(`✓ products: ${prod.length} rows`);

  // product_descriptions
  const pd = await loadDir('product_descriptions');
  const insPd = db.prepare(`INSERT OR IGNORE INTO product_descriptions VALUES (?,?,?)`);
  const runPd = db.transaction((rows) => {
    for (const r of rows) insPd.run(r.product,r.language,r.productDescription);
  });
  runPd(pd);
  console.log(`✓ product_descriptions: ${pd.length} rows`);

  // product_plants
  const pp = await loadDir('product_plants');
  const insPp = db.prepare(`INSERT OR IGNORE INTO product_plants VALUES (?,?,?,?)`);
  const runPp = db.transaction((rows) => {
    for (const r of rows) insPp.run(r.product,r.plant,r.profitCenter,r.availabilityCheckType);
  });
  runPp(pp);
  console.log(`✓ product_plants: ${pp.length} rows`);

  // product_storage_locations
  const psl = await loadDir('product_storage_locations');
  const insPsl = db.prepare(`INSERT OR IGNORE INTO product_storage_locations VALUES (?,?,?)`);
  const runPsl = db.transaction((rows) => {
    for (const r of rows) insPsl.run(r.product,r.plant,r.storageLocation);
  });
  runPsl(psl);
  console.log(`✓ product_storage_locations: ${psl.length} rows`);

  // plants
  const pl = await loadDir('plants');
  const insPl = db.prepare(`INSERT OR IGNORE INTO plants VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const runPl = db.transaction((rows) => {
    for (const r of rows) insPl.run(r.plant,r.plantName,r.companyCode,r.factoryCalendar,r.language,r.streetName,r.houseNumber,r.cityName,r.region,r.postalCode,r.country);
  });
  runPl(pl);
  console.log(`✓ plants: ${pl.length} rows`);

  console.log('\n✅ Data loading complete!');
  db.close();
}

main().catch(console.error);

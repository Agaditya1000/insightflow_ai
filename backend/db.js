const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'o2c.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Create all tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sales_order_headers (
    salesOrder TEXT PRIMARY KEY,
    salesOrderType TEXT, salesOrganization TEXT, distributionChannel TEXT,
    organizationDivision TEXT, salesGroup TEXT, salesOffice TEXT,
    soldToParty TEXT, creationDate TEXT, createdByUser TEXT,
    lastChangeDateTime TEXT, totalNetAmount TEXT,
    overallDeliveryStatus TEXT, overallOrdReltdBillgStatus TEXT,
    overallSdDocReferenceStatus TEXT, transactionCurrency TEXT,
    pricingDate TEXT, requestedDeliveryDate TEXT,
    headerBillingBlockReason TEXT, deliveryBlockReason TEXT,
    incotermsClassification TEXT, incotermsLocation1 TEXT,
    customerPaymentTerms TEXT, totalCreditCheckStatus TEXT
  );

  CREATE TABLE IF NOT EXISTS sales_order_items (
    salesOrder TEXT, salesOrderItem TEXT, material TEXT,
    salesOrderItemText TEXT, requestedQuantity TEXT, requestedQuantityUnit TEXT,
    itemGrossWeight TEXT, itemNetWeight TEXT, itemWeightUnit TEXT,
    netAmount TEXT, transactionCurrency TEXT, materialGroup TEXT,
    productionPlant TEXT, storageLocation TEXT,
    deliveryGroup TEXT, shippingPoint TEXT,
    PRIMARY KEY (salesOrder, salesOrderItem)
  );

  CREATE TABLE IF NOT EXISTS sales_order_schedule_lines (
    salesOrder TEXT, salesOrderItem TEXT, scheduleLine TEXT,
    requestedDeliveryDate TEXT, confirmedDeliveryDate TEXT,
    scheduledQuantity TEXT, deliveredQuantityInBaseUnit TEXT,
    correctedQtyInBaseUnit TEXT, orderQuantityUnit TEXT,
    PRIMARY KEY (salesOrder, salesOrderItem, scheduleLine)
  );

  CREATE TABLE IF NOT EXISTS billing_document_headers (
    billingDocument TEXT PRIMARY KEY,
    billingDocumentType TEXT, creationDate TEXT,
    creationTimeHours INTEGER, creationTimeMinutes INTEGER, creationTimeSeconds INTEGER,
    lastChangeDateTime TEXT, billingDocumentDate TEXT,
    billingDocumentIsCancelled INTEGER, cancelledBillingDocument TEXT,
    totalNetAmount TEXT, transactionCurrency TEXT, companyCode TEXT,
    fiscalYear TEXT, accountingDocument TEXT, soldToParty TEXT
  );

  CREATE TABLE IF NOT EXISTS billing_document_items (
    billingDocument TEXT, billingDocumentItem TEXT,
    material TEXT, billingQuantity TEXT, billingQuantityUnit TEXT,
    netAmount TEXT, transactionCurrency TEXT, plant TEXT,
    salesDocument TEXT, salesDocumentItem TEXT,
    referenceSDDocument TEXT, referenceSDDocumentItem TEXT,
    PRIMARY KEY (billingDocument, billingDocumentItem)
  );

  CREATE TABLE IF NOT EXISTS billing_document_cancellations (
    billingDocument TEXT PRIMARY KEY,
    cancelledBillingDocument TEXT, cancellationReason TEXT,
    creationDate TEXT, creationTimeHours INTEGER,
    creationTimeMinutes INTEGER, creationTimeSeconds INTEGER
  );

  CREATE TABLE IF NOT EXISTS outbound_delivery_headers (
    deliveryDocument TEXT PRIMARY KEY,
    deliveryDocumentType TEXT, shippingPoint TEXT,
    deliveryDate TEXT, creationDate TEXT, createdByUser TEXT,
    lastChangeDateTime TEXT, deliveryDocumentBySupplier TEXT,
    salesOrganization TEXT, soldToParty TEXT, shiptoParty TEXT,
    overallGoodsMovementStatus TEXT, overallPickingStatus TEXT,
    overallPackingStatus TEXT, overallDeliveryStatus TEXT
  );

  CREATE TABLE IF NOT EXISTS outbound_delivery_items (
    deliveryDocument TEXT, deliveryDocumentItem TEXT,
    referenceSDDocument TEXT, referenceSDDocumentItem TEXT,
    material TEXT, deliveryQuantity TEXT, deliveryQuantityUnit TEXT,
    plant TEXT, storageLocation TEXT, batch TEXT,
    actualDeliveryRoute TEXT,
    PRIMARY KEY (deliveryDocument, deliveryDocumentItem)
  );

  CREATE TABLE IF NOT EXISTS journal_entry_items (
    accountingDocument TEXT, accountingDocumentItem TEXT,
    companyCode TEXT, fiscalYear TEXT, glAccount TEXT,
    referenceDocument TEXT, costCenter TEXT, profitCenter TEXT,
    transactionCurrency TEXT, amountInTransactionCurrency TEXT,
    companyCodeCurrency TEXT, amountInCompanyCodeCurrency TEXT,
    postingDate TEXT, documentDate TEXT, accountingDocumentType TEXT,
    assignmentReference TEXT, lastChangeDateTime TEXT,
    customer TEXT, financialAccountType TEXT,
    clearingDate TEXT, clearingAccountingDocument TEXT, clearingDocFiscalYear TEXT,
    PRIMARY KEY (accountingDocument, accountingDocumentItem)
  );

  CREATE TABLE IF NOT EXISTS payments_ar (
    accountingDocument TEXT PRIMARY KEY,
    companyCode TEXT, fiscalYear TEXT, glAccount TEXT,
    referenceDocument TEXT, costCenter TEXT, profitCenter TEXT,
    transactionCurrency TEXT, amountInTransactionCurrency TEXT,
    companyCodeCurrency TEXT, amountInCompanyCodeCurrency TEXT,
    postingDate TEXT, documentDate TEXT, accountingDocumentType TEXT,
    customer TEXT, financialAccountType TEXT
  );

  CREATE TABLE IF NOT EXISTS business_partners (
    businessPartner TEXT PRIMARY KEY,
    businessPartnerFullName TEXT, businessPartnerFirstName TEXT,
    businessPartnerLastName TEXT, businessPartnerGrouping TEXT,
    birthDate TEXT, bpCreditStanding TEXT, academicTitle TEXT,
    academicTitle2 TEXT, additionalLastName TEXT
  );

  CREATE TABLE IF NOT EXISTS business_partner_addresses (
    businessPartner TEXT, addressID TEXT,
    streetName TEXT, houseNumber TEXT, cityName TEXT,
    region TEXT, postalCode TEXT, country TEXT,
    PRIMARY KEY (businessPartner, addressID)
  );

  CREATE TABLE IF NOT EXISTS customer_company_assignments (
    customer TEXT, companyCode TEXT,
    paymentTerms TEXT, accountGroup TEXT, dueDateCalculationBase TEXT,
    cashDiscountDaysOne TEXT, cashDiscountDaysTwo TEXT,
    cashDiscountPercentageOne TEXT, cashDiscountPercentageTwo TEXT,
    netPaymentDays TEXT, creditControlArea TEXT, customerAccountGroup TEXT,
    PRIMARY KEY (customer, companyCode)
  );

  CREATE TABLE IF NOT EXISTS customer_sales_area_assignments (
    customer TEXT, salesOrganization TEXT, distributionChannel TEXT, division TEXT,
    salesOffice TEXT, salesGroup TEXT, deliveryPriority TEXT,
    orderProbabilityInPercent TEXT, customerPaymentTerms TEXT,
    incotermsClassification TEXT, incotermsVersion TEXT,
    incotermsLocation1 TEXT, incotermsLocation2 TEXT,
    PRIMARY KEY (customer, salesOrganization, distributionChannel, division)
  );

  CREATE TABLE IF NOT EXISTS products (
    product TEXT PRIMARY KEY,
    baseUnit TEXT, productType TEXT, grossWeight TEXT, netWeight TEXT,
    weightUnit TEXT, volumeUnit TEXT, volume TEXT, materialGroup TEXT,
    productGroup TEXT, externalProductGroup TEXT, crossPlantStatus TEXT,
    crossPlantStatusValidityDate TEXT, creationDate TEXT
  );

  CREATE TABLE IF NOT EXISTS product_descriptions (
    product TEXT, language TEXT, productDescription TEXT,
    PRIMARY KEY (product, language)
  );

  CREATE TABLE IF NOT EXISTS product_plants (
    product TEXT, plant TEXT,
    profitCenter TEXT, availabilityCheckType TEXT,
    PRIMARY KEY (product, plant)
  );

  CREATE TABLE IF NOT EXISTS product_storage_locations (
    product TEXT, plant TEXT, storageLocation TEXT,
    PRIMARY KEY (product, plant, storageLocation)
  );

  CREATE TABLE IF NOT EXISTS plants (
    plant TEXT PRIMARY KEY,
    plantName TEXT, companyCode TEXT,
    factoryCalendar TEXT, language TEXT,
    streetName TEXT, houseNumber TEXT, cityName TEXT,
    region TEXT, postalCode TEXT, country TEXT
  );
`);

module.exports = db;

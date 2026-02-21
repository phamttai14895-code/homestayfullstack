export function getSepayBankInfo() {
  const bankBin = process.env.SEPAY_BANK_BIN || process.env.BANK_BIN || "";
  return {
    bank_name: process.env.SEPAY_BANK_NAME || process.env.BANK_NAME || "",
    account_number: process.env.SEPAY_BANK_ACCOUNT || process.env.BANK_ACCOUNT_NUMBER || "",
    account_name: process.env.SEPAY_ACCOUNT_NAME || process.env.BANK_ACCOUNT_NAME || "",
    bank_bin: bankBin,
    qr_url_template:
      process.env.SEPAY_QR_URL_TEMPLATE ||
      "https://qr.sepay.vn/img?acc={ACC}&bank={BANK}&amount={AMOUNT}&des={DES}"
  };
}

export function sepayBuildQr({ amount, content }) {
  const acct = process.env.SEPAY_BANK_ACCOUNT || "";
  const bank = process.env.SEPAY_BANK_NAME || "BIDV";
  const QR_URL_TEMPLATE =
    process.env.SEPAY_QR_URL_TEMPLATE ||
    "https://qr.sepay.vn/img?acc={ACC}&bank={BANK}&amount={AMOUNT}&des={DES}";
  return QR_URL_TEMPLATE
    .replace("{ACC}", encodeURIComponent(acct))
    .replace("{BANK}", encodeURIComponent(bank))
    .replace("{AMOUNT}", encodeURIComponent(String(amount || 0)))
    .replace("{DES}", encodeURIComponent(content || ""));
}
